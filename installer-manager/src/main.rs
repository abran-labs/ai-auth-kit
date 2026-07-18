mod activation;
mod bundle;
mod directory;
mod fault;
mod fs;
mod release;
mod root;
mod state;
mod trust;

use std::env;
use std::path::PathBuf;

use crate::release::{AttestationMode, load};
use crate::state::{InstallOptions, install, rollback, uninstall};

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
enum Mode {
    Install,
    Update,
    Rollback,
    Uninstall,
}

#[derive(Debug)]
struct Options {
    mode: Mode,
    release_dir: PathBuf,
    version: Option<String>,
    dry_run: bool,
    force: bool,
    test_bundle: Option<PathBuf>,
    signed_bundle: Option<PathBuf>,
}

fn usage() -> &'static str {
    "Usage:\n  ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE [--version vX.Y.Z] [--dry-run] [--force] [--yes]\n  ai-auth-kit-installer-manager --release-dir DIRECTORY --attestation-receipt SIGNED_BUNDLE --update [--dry-run] [--force] [--yes]\n  ai-auth-kit-installer-manager --release-dir DIRECTORY --rollback [--dry-run] [--force] [--yes]\n  ai-auth-kit-installer-manager --release-dir DIRECTORY --uninstall [--dry-run] [--force] [--yes]\n\nInstall/update read DIRECTORY and require exactly one signed receipt. rollback/uninstall require but do not read DIRECTORY; they use retained managed state."
}

fn options(args: impl Iterator<Item = String>) -> Result<Options, String> {
    let mut mode = Mode::Install;
    let mut release_dir = None;
    let mut version = None;
    let mut dry_run = false;
    let mut force = false;
    #[cfg(feature = "test-manager")]
    let mut test_bundle = None;
    #[cfg(not(feature = "test-manager"))]
    let test_bundle = None;
    let mut signed_bundle = None;
    let mut values = args.peekable();
    while let Some(argument) = values.next() {
        match argument.as_str() {
            "--release-dir" => {
                release_dir = Some(PathBuf::from(
                    values.next().ok_or("--release-dir needs a directory")?,
                ))
            }
            "--version" => version = Some(values.next().ok_or("--version needs vX.Y.Z")?),
            "--update" => mode = Mode::Update,
            "--rollback" => mode = Mode::Rollback,
            "--uninstall" => mode = Mode::Uninstall,
            "--dry-run" => dry_run = true,
            "--force" => force = true,
            "--test-attestation" => {
                #[cfg(feature = "test-manager")]
                {
                    test_bundle = Some(PathBuf::from(
                        values
                            .next()
                            .ok_or("--test-attestation needs a signed test bundle")?,
                    ));
                }
                #[cfg(not(feature = "test-manager"))]
                {
                    let _ = values.next();
                    return Err(
                        "--test-attestation exists only in the test-manager binary".to_owned()
                    );
                }
            }
            "--attestation-receipt" => {
                signed_bundle = Some(PathBuf::from(
                    values
                        .next()
                        .ok_or("--attestation-receipt needs a signed bundle")?,
                ))
            }
            "--yes" => {}
            "--help" => return Err(usage().to_owned()),
            _ => return Err(format!("unknown option: {argument}")),
        }
    }
    let release_dir = release_dir
        .ok_or("--release-dir is required; bootstrap supplies the authenticated release source")?;
    if matches!(mode, Mode::Rollback | Mode::Uninstall) && version.is_some() {
        return Err("--version conflicts with rollback/uninstall".to_owned());
    }
    if matches!(mode, Mode::Install | Mode::Update)
        && (test_bundle.is_some() == signed_bundle.is_some())
    {
        return Err("install/update requires exactly one explicit attestation receipt; attestation.test.json is never public proof".to_owned());
    }
    Ok(Options {
        mode,
        release_dir,
        version,
        dry_run,
        force,
        test_bundle,
        signed_bundle,
    })
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    if arguments.as_slice() == ["--help"] {
        println!("{}", usage());
        return;
    }
    let result = options(arguments.into_iter()).and_then(run);
    if let Err(error) = result {
        eprintln!("error: {error}");
        std::process::exit(1);
    }
}

fn run(options: Options) -> Result<(), String> {
    let roots = InstallOptions::from_environment(options.dry_run, options.force)?;
    match options.mode {
        Mode::Uninstall => uninstall(&roots),
        Mode::Rollback => rollback(&roots),
        Mode::Install | Mode::Update => {
            let attestation = match (&options.test_bundle, &options.signed_bundle) {
                #[cfg(feature = "test-manager")]
                (Some(path), None) => AttestationMode::LocalTest(path),
                #[cfg(not(feature = "test-manager"))]
                (Some(_), None) => {
                    return Err(
                        "--test-attestation exists only in the test-manager binary".to_owned()
                    );
                }
                (None, Some(path)) => AttestationMode::PublicBundle(path),
                (Some(_), Some(_)) | (None, None) => {
                    return Err("missing or ambiguous attestation mode".to_owned());
                }
            };
            let release = load(
                &options.release_dir,
                options.version.as_deref(),
                attestation,
            )?;
            install(&roots, &release)
        }
    }
}

#[cfg(all(test, not(feature = "test-manager")))]
mod tests {
    use super::{options, usage};

    #[test]
    fn help_separates_verified_release_modes_from_local_state_modes() {
        let help = usage();
        assert!(help.contains("--attestation-receipt SIGNED_BUNDLE [--version vX.Y.Z]"));
        assert!(help.contains("--attestation-receipt SIGNED_BUNDLE --update"));
        assert!(help.contains("--release-dir DIRECTORY --rollback"));
        assert!(help.contains("--release-dir DIRECTORY --uninstall"));
        assert!(help.contains("rollback/uninstall require but do not read DIRECTORY"));
    }

    #[test]
    fn public_binary_rejects_local_test_mode() {
        let result = options(
            [
                "--release-dir".to_owned(),
                "release".to_owned(),
                "--test-attestation".to_owned(),
                "fixture.json".to_owned(),
            ]
            .into_iter(),
        );
        assert!(result.is_err());
    }
}
