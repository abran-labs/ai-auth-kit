use base64::Engine as _;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::Deserialize;

use crate::trust::{REPOSITORY, WORKFLOW, public_key};

pub const SCHEMA: &str = "ai-auth-kit-signed-release-bundle-v1";

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SignedBundle {
    pub schema: String,
    pub key_id: String,
    pub repository: String,
    pub workflow: String,
    pub tag: String,
    pub version: String,
    #[serde(rename = "sourceCommit")]
    pub source_commit: String,
    #[serde(rename = "manifestSha256")]
    pub manifest_sha256: String,
    pub assets: Vec<BundleAsset>,
    pub attestation: Attestation,
    pub signature: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BundleAsset {
    pub name: String,
    pub target: String,
    pub os: String,
    pub arch: String,
    pub libc: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attestation {
    pub kind: String,
    pub verifier: String,
    pub verified: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum BundleMode {
    Public,
    #[cfg(feature = "test-manager")]
    LocalTest,
}

pub fn load_and_verify(path: &std::path::Path, mode: BundleMode) -> Result<SignedBundle, String> {
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    let bundle: SignedBundle = serde_json::from_slice(&bytes)
        .map_err(|error| format!("signed bundle parse failed: {error}"))?;
    let key = match mode {
        BundleMode::Public => public_key()?,
        #[cfg(feature = "test-manager")]
        BundleMode::LocalTest => crate::trust::test_public_key()?,
    };
    if bundle.schema != SCHEMA
        || bundle.repository != REPOSITORY
        || bundle.workflow != WORKFLOW
        || bundle.key_id != key.key_id
        || bundle.attestation.kind != "github-attestation-verified-v1"
        || bundle.attestation.verifier != "gh-attestation-verify"
        || !bundle.attestation.verified
    {
        return Err("signed bundle identity metadata is invalid".to_owned());
    }
    let public_key = VerifyingKey::from_bytes(&key.bytes()?)
        .map_err(|_| "embedded Ed25519 public key is not a valid point".to_owned())?;
    let signature_bytes = base64::engine::general_purpose::STANDARD
        .decode(&bundle.signature)
        .map_err(|_| "signed bundle signature is not base64".to_owned())?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "signed bundle signature is malformed".to_owned())?;
    public_key
        .verify_strict(&canonical_bytes(&bundle)?, &signature)
        .map_err(|_| "signed bundle signature verification failed".to_owned())?;
    Ok(bundle)
}

pub fn canonical_bytes(bundle: &SignedBundle) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    output.extend_from_slice(b"ai-auth-kit-signed-release-bundle-v1\0");
    for value in [
        bundle.schema.as_str(),
        bundle.key_id.as_str(),
        bundle.repository.as_str(),
        bundle.workflow.as_str(),
        bundle.tag.as_str(),
        bundle.version.as_str(),
        bundle.source_commit.as_str(),
        bundle.manifest_sha256.as_str(),
    ] {
        write_string(&mut output, value)?;
    }
    write_count(&mut output, bundle.assets.len())?;
    for asset in &bundle.assets {
        for value in [
            asset.name.as_str(),
            asset.target.as_str(),
            asset.os.as_str(),
            asset.arch.as_str(),
            asset.libc.as_str(),
            asset.sha256.as_str(),
        ] {
            write_string(&mut output, value)?;
        }
        output.extend_from_slice(&asset.size.to_be_bytes());
    }
    for value in [
        bundle.attestation.kind.as_str(),
        bundle.attestation.verifier.as_str(),
        if bundle.attestation.verified {
            "true"
        } else {
            "false"
        },
    ] {
        write_string(&mut output, value)?;
    }
    Ok(output)
}

fn write_string(output: &mut Vec<u8>, value: &str) -> Result<(), String> {
    let length = u32::try_from(value.len()).map_err(|_| "signed bundle field is too long")?;
    output.extend_from_slice(&length.to_be_bytes());
    output.extend_from_slice(value.as_bytes());
    Ok(())
}

fn write_count(output: &mut Vec<u8>, count: usize) -> Result<(), String> {
    let count = u32::try_from(count).map_err(|_| "signed bundle has too many assets")?;
    output.extend_from_slice(&count.to_be_bytes());
    Ok(())
}
