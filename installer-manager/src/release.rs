use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use std::io::{Read, Seek, SeekFrom};
use std::os::fd::AsRawFd;
use std::path::Path;

use crate::bundle::{BundleMode, SignedBundle, load_and_verify};
use crate::trust::sha256_open_file;

#[derive(Debug)]
pub enum AttestationMode<'a> {
    #[cfg(feature = "test-manager")]
    LocalTest(&'a Path),
    PublicBundle(&'a Path),
}

#[derive(Debug, Deserialize)]
struct Manifest {
    version: String,
    #[serde(rename = "sourceCommit")]
    source_commit: String,
    artifacts: Vec<Artifact>,
}
#[derive(Debug, Deserialize)]
struct Artifact {
    filename: String,
    target: String,
    os: String,
    arch: String,
    libc: String,
    #[serde(rename = "runtimePrerequisites")]
    runtime_prerequisites: Vec<String>,
    sha256: String,
    size: u64,
}
#[derive(Debug)]
pub struct VerifiedRelease {
    pub version: String,
    pub artifact: std::fs::File,
    pub digest: String,
}

fn target() -> Result<(&'static str, &'static str), String> {
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        value => return Err(format!("unsupported architecture: {value}")),
    };
    Ok((arch, "linux"))
}

fn libc_family() -> Result<&'static str, String> {
    if let Some(value) = std::env::var_os("AI_AUTH_KIT_TEST_LIBC") {
        return match value.to_string_lossy().as_ref() {
            "glibc" => Ok("glibc"),
            "musl" => Ok("musl"),
            _ => Err("test libc selector is malformed".to_owned()),
        };
    }
    let output = std::process::Command::new("ldd")
        .arg("--version")
        .output()
        .map_err(|error| error.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout).to_ascii_lowercase()
        + &String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    if text.contains("musl") {
        Ok("musl")
    } else if text.contains("glibc") || text.contains("gnu libc") {
        Ok("glibc")
    } else {
        Err("unsupported or unknown libc".to_owned())
    }
}

pub fn load(
    directory: &Path,
    requested: Option<&str>,
    attestation: AttestationMode<'_>,
) -> Result<VerifiedRelease, String> {
    let release_directory = crate::fs::safe_directory(directory, false)?;
    let mut manifest_file = crate::fs::regular_at(&release_directory, "manifest.json")?;
    let (manifest_digest, _) = sha256_open_file(&mut manifest_file)?;
    manifest_file
        .seek(SeekFrom::Start(0))
        .map_err(|error| error.to_string())?;
    let mut manifest_bytes = Vec::new();
    manifest_file
        .read_to_end(&mut manifest_bytes)
        .map_err(|error| error.to_string())?;
    let manifest: Manifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| format!("manifest parse failed: {error}"))?;
    if !valid_version(&manifest.version) || !valid_commit(&manifest.source_commit) {
        return Err("manifest version or source commit is malformed".to_owned());
    }
    let tag = format!("v{}", manifest.version);
    if requested.is_some_and(|value| value != tag) {
        return Err("requested version does not match stable release".to_owned());
    }
    let expected = expected_inventory(&manifest.version);
    let names: BTreeSet<_> = manifest
        .artifacts
        .iter()
        .map(|item| item.filename.clone())
        .collect();
    if names != expected.keys().cloned().collect() {
        return Err("manifest must contain canonical six-artifact inventory".to_owned());
    }
    validate_manifest(&manifest, &expected)?;
    verify_sums(&release_directory, &manifest.artifacts)?;
    let (arch, os) = target()?;
    let libc = libc_family()?;
    let artifact = manifest
        .artifacts
        .iter()
        .find(|item| item.os == os && item.arch == arch && item.libc == libc)
        .ok_or("selected Linux artifact missing")?;
    let bundle = match attestation {
        #[cfg(feature = "test-manager")]
        AttestationMode::LocalTest(path) => load_and_verify(path, BundleMode::LocalTest)?,
        AttestationMode::PublicBundle(path) => load_and_verify(path, BundleMode::Public)?,
    };
    verify_bundle(&bundle, &manifest, &tag, &manifest_digest)?;
    let mut artifact_file = crate::fs::regular_at(&release_directory, &artifact.filename)?;
    validate_artifact_file(&artifact_file, artifact)?;
    let (digest, size) = sha256_open_file(&mut artifact_file)?;
    if digest != artifact.sha256 || size != artifact.size {
        return Err("selected artifact digest or size mismatch".to_owned());
    }
    verify_runtime_prerequisites(artifact, &artifact_file)?;
    Ok(VerifiedRelease {
        version: manifest.version,
        artifact: artifact_file,
        digest,
    })
}

fn verify_bundle(
    bundle: &SignedBundle,
    manifest: &Manifest,
    tag: &str,
    manifest_digest: &str,
) -> Result<(), String> {
    if bundle.tag != tag
        || bundle.version != manifest.version
        || bundle.source_commit != manifest.source_commit
        || bundle.manifest_sha256 != manifest_digest
        || bundle.assets.len() != manifest.artifacts.len()
    {
        return Err("signed bundle release coordinates do not match manifest".to_owned());
    }
    let mut bundle_assets = BTreeSet::new();
    for asset in &bundle.assets {
        if !bundle_assets.insert(&asset.name) {
            return Err("signed bundle has duplicate asset names".to_owned());
        }
        let matching = manifest.artifacts.iter().find(|manifest_asset| {
            manifest_asset.filename == asset.name
                && manifest_asset.os == asset.os
                && manifest_asset.target == asset.target
                && manifest_asset.arch == asset.arch
                && manifest_asset.libc == asset.libc
                && manifest_asset.sha256 == asset.sha256
                && manifest_asset.size == asset.size
        });
        if matching.is_none() {
            return Err("signed bundle asset does not exactly match manifest".to_owned());
        }
    }
    Ok(())
}

fn expected_inventory(version: &str) -> BTreeMap<String, String> {
    [
        (
            format!("ai-auth-kit-{version}-linux-x64-baseline"),
            "bun-linux-x64-baseline",
        ),
        (
            format!("ai-auth-kit-{version}-linux-x64-musl"),
            "bun-linux-x64-musl",
        ),
        (
            format!("ai-auth-kit-{version}-linux-arm64"),
            "bun-linux-arm64",
        ),
        (
            format!("ai-auth-kit-{version}-linux-arm64-musl"),
            "bun-linux-arm64-musl",
        ),
        (
            "ai-auth-kit-installer-manager-linux-x64-musl".to_owned(),
            "manager-x64-musl",
        ),
        (
            "ai-auth-kit-installer-manager-linux-arm64-musl".to_owned(),
            "manager-arm64-musl",
        ),
    ]
    .into_iter()
    .map(|(filename, target)| (filename, target.to_owned()))
    .collect()
}

fn validate_manifest(
    manifest: &Manifest,
    expected: &BTreeMap<String, String>,
) -> Result<(), String> {
    if manifest.artifacts.len() != expected.len() {
        return Err("manifest must contain exactly six artifacts".to_owned());
    }
    let mut targets = BTreeSet::new();
    let mut digests = BTreeSet::new();
    for asset in &manifest.artifacts {
        if !valid_digest(&asset.sha256) || asset.size == 0 {
            return Err("manifest artifact digest or size is malformed".to_owned());
        }
        if expected.get(&asset.filename) != Some(&asset.target) {
            return Err("manifest artifact target is not canonical".to_owned());
        }
        if canonical_platform(&asset.target)
            != Some((asset.os.as_str(), asset.arch.as_str(), asset.libc.as_str()))
        {
            return Err("manifest artifact platform selector is not canonical".to_owned());
        }
        let expected_runtime =
            if asset.target.ends_with("-musl") && !asset.target.starts_with("manager-") {
                ["libstdc++.so.6", "libgcc_s.so.1"].as_slice()
            } else {
                [].as_slice()
            };
        if asset
            .runtime_prerequisites
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            != expected_runtime
        {
            return Err("manifest artifact runtime prerequisites are not canonical".to_owned());
        }
        if !targets.insert(&asset.target) {
            return Err("manifest has duplicate artifact target".to_owned());
        }
        if !digests.insert(&asset.sha256) {
            return Err("manifest has duplicate artifact digest".to_owned());
        }
    }
    Ok(())
}

fn canonical_platform(target: &str) -> Option<(&str, &str, &str)> {
    match target {
        "bun-linux-x64-baseline" => Some(("linux", "x64", "glibc")),
        "bun-linux-x64-musl" | "manager-x64-musl" => Some(("linux", "x64", "musl")),
        "bun-linux-arm64" => Some(("linux", "arm64", "glibc")),
        "bun-linux-arm64-musl" | "manager-arm64-musl" => Some(("linux", "arm64", "musl")),
        _ => None,
    }
}

fn validate_artifact_file(file: &std::fs::File, artifact: &Artifact) -> Result<(), String> {
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    if metadata.len() != artifact.size {
        return Err("selected artifact size mismatch".to_owned());
    }
    Ok(())
}

fn verify_runtime_prerequisites(artifact: &Artifact, file: &std::fs::File) -> Result<(), String> {
    if artifact.runtime_prerequisites.is_empty() {
        return Ok(());
    }
    let stable = format!("/proc/{}/fd/{}", std::process::id(), file.as_raw_fd());
    let output = std::process::Command::new("ldd")
        .arg(stable)
        .output()
        .map_err(|error| format!("could not inspect runtime prerequisites: {error}"))?;
    let text = String::from_utf8_lossy(&output.stdout).to_ascii_lowercase()
        + &String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    if !output.status.success() || text.contains("not found") {
        return Err(
            "selected musl CLI requires Alpine package: apk add --no-cache libstdc++".to_owned(),
        );
    }
    Ok(())
}

fn verify_sums(directory: &std::fs::File, artifacts: &[Artifact]) -> Result<(), String> {
    let mut file = crate::fs::regular_at(directory, "SHA256SUMS")?;
    let mut text = String::new();
    file.read_to_string(&mut text)
        .map_err(|error| error.to_string())?;
    let mut sums = BTreeMap::new();
    for line in text.lines() {
        let Some((digest, name)) = line.split_once("  ") else {
            return Err("SHA256SUMS line is malformed".to_owned());
        };
        if !valid_digest(digest) || sums.insert(name, digest).is_some() {
            return Err("SHA256SUMS has malformed or duplicate entries".to_owned());
        }
    }
    if sums.len() != artifacts.len()
        || artifacts
            .iter()
            .any(|asset| sums.get(asset.filename.as_str()) != Some(&asset.sha256.as_str()))
    {
        return Err("SHA256SUMS is not the exact manifest projection".to_owned());
    }
    Ok(())
}
fn valid_version(value: &str) -> bool {
    value.split('.').count() == 3
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'.')
}
fn valid_commit(value: &str) -> bool {
    value.len() == 40
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}
fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

#[cfg(test)]
mod tests {
    use super::{
        Artifact, Manifest, expected_inventory, valid_commit, valid_digest, valid_version,
        validate_manifest, verify_sums,
    };

    fn artifact(filename: &str, target: &str, digest: char) -> Artifact {
        Artifact {
            filename: filename.to_owned(),
            target: target.to_owned(),
            os: "linux".to_owned(),
            arch: if filename.contains("arm64") {
                "arm64"
            } else {
                "x64"
            }
            .to_owned(),
            libc: if filename.contains("baseline") {
                "glibc"
            } else {
                "musl"
            }
            .to_owned(),
            runtime_prerequisites: if target.ends_with("-musl") && !target.starts_with("manager-") {
                vec!["libstdc++.so.6".to_owned(), "libgcc_s.so.1".to_owned()]
            } else {
                Vec::new()
            },
            sha256: digest.to_string().repeat(64),
            size: 1,
        }
    }

    fn manifest() -> Manifest {
        let expected = expected_inventory("0.2.0");
        Manifest {
            version: "0.2.0".to_owned(),
            source_commit: "a".repeat(40),
            artifacts: expected
                .iter()
                .zip(['a', 'b', 'c', 'd', 'e', 'f'])
                .map(|((filename, target), digest)| artifact(filename, target, digest))
                .collect(),
        }
    }

    #[test]
    fn rejects_noncanonical_release_coordinates() {
        assert!(valid_version("0.2.0"));
        assert!(!valid_version("0.2"));
        assert!(valid_commit(&"a".repeat(40)));
        assert!(!valid_commit(&"A".repeat(40)));
        assert!(valid_digest(&"b".repeat(64)));
        assert!(!valid_digest("x"));
    }

    #[test]
    fn rejects_duplicate_target_and_digest_before_trust() {
        let mut value = manifest();
        value.artifacts[1].target = value.artifacts[0].target.clone();
        assert!(validate_manifest(&value, &expected_inventory("0.2.0")).is_err());
        let mut value = manifest();
        value.artifacts[1].sha256 = value.artifacts[0].sha256.clone();
        assert!(validate_manifest(&value, &expected_inventory("0.2.0")).is_err());
    }

    #[test]
    fn rejects_duplicate_checksum_projection() {
        let value = manifest();
        let directory =
            std::env::temp_dir().join(format!("ai-auth-kit-sums-{}", std::process::id()));
        let path = directory.join("SHA256SUMS");
        let repeated = format!(
            "{}  {}\n{}  {}\n",
            value.artifacts[0].sha256,
            value.artifacts[0].filename,
            value.artifacts[0].sha256,
            value.artifacts[0].filename,
        );
        assert!(std::fs::create_dir(&directory).is_ok());
        assert!(std::fs::write(&path, repeated).is_ok());
        let held = crate::fs::safe_directory(&directory, false);
        assert!(held.is_ok());
        if let Ok(held) = held {
            assert!(verify_sums(&held, &value.artifacts).is_err());
        }
        assert!(std::fs::remove_file(&path).is_ok());
        assert!(std::fs::remove_dir(&directory).is_ok());
    }
}
