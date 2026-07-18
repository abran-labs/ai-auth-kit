use std::fs::File;
use std::os::fd::AsRawFd;
use std::path::PathBuf;

use crate::directory::{
    existing_managed_child_directory, managed_child_directory, managed_directory,
};
use crate::fs::{
    entry_exists, read_link_at, regular_at, safe_directory, symlink_replace, write_new_bytes,
    write_new_from_file,
};
use crate::release::VerifiedRelease;
use crate::root::ManagedRoot;
use crate::trust::sha256_open_file;

#[derive(Debug)]
pub struct InstallOptions {
    pub(crate) root: PathBuf,
    bin: PathBuf,
    dry_run: bool,
}

impl InstallOptions {
    pub fn from_environment(dry_run: bool, _force: bool) -> Result<Self, String> {
        let home = std::env::var_os("HOME").ok_or("HOME is required")?;
        let data = std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(&home).join(".local/share"));
        Ok(Self {
            root: data.join("ai-auth-kit"),
            bin: PathBuf::from(home).join(".local/bin"),
            dry_run,
        })
    }
}

fn lock(root: &File) -> Result<File, String> {
    let lock = crate::fs::write_new_bytes(root, "lock", b"", 0o600).or(Ok::<(), String>(()));
    lock?;
    let file = regular_at(root, "lock")?;
    // SAFETY: `flock` consumes only the valid descriptor owned by `file`.
    if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) } != 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    Ok(file)
}

fn object_name(digest: &str) -> String {
    format!("sha256-{digest}")
}

fn generation_name(version: &str) -> String {
    format!(
        "{version}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |value| value.as_nanos())
    )
}

fn valid_generation(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-'))
}

fn current_generation(root: &File) -> Result<Option<String>, String> {
    if !entry_exists(root, "current")? {
        return Ok(None);
    }
    let target = read_link_at(root, "current")?;
    let Some(name) = target.strip_prefix("generations/") else {
        return Err("current is not a managed generation link".to_owned());
    };
    if !valid_generation(name) {
        return Err("current generation name is malformed".to_owned());
    }
    Ok(Some(name.to_owned()))
}

fn generation_state(
    generations: &File,
    generation: &str,
) -> Result<(String, Option<String>), String> {
    let directory = managed_child_directory(generations, generation, false)?;
    let mut state = regular_at(&directory, "state")?;
    let mut text = String::new();
    use std::io::Read;
    state
        .read_to_string(&mut text)
        .map_err(|error| error.to_string())?;
    let mut object = None;
    let mut previous = None;
    for line in text.lines() {
        if let Some(value) = line.strip_prefix("object=") {
            object = Some(value.to_owned());
        }
        if let Some(value) = line.strip_prefix("previous=") {
            previous = Some(value.to_owned());
        }
    }
    let object = object.ok_or("generation state has no object")?;
    if !object.starts_with("sha256-") || !valid_generation(&object) {
        return Err("generation object is malformed".to_owned());
    }
    if let Some(value) = &previous {
        if !value.is_empty() && !valid_generation(value) {
            return Err("generation previous value is malformed".to_owned());
        }
    }
    Ok((object, previous))
}

fn create_generation(
    root: &File,
    generations: &File,
    version: &str,
    object: &str,
    previous: Option<&str>,
) -> Result<String, String> {
    let generation = generation_name(version);
    let directory = managed_child_directory(generations, &generation, true)?;
    symlink_replace(
        &directory,
        ".binary",
        &format!("../../objects/{object}"),
        "ai-auth-kit",
        "generation",
    )?;
    let state = format!(
        "version={version}\nobject={object}\nprevious={}\n",
        previous.unwrap_or("")
    );
    write_new_bytes(&directory, "state", state.as_bytes(), 0o600)?;
    crate::fault::after("state-write");
    directory.sync_all().map_err(|error| error.to_string())?;
    crate::fault::after("generation-fsync");
    symlink_replace(
        root,
        ".current",
        &format!("generations/{generation}"),
        "current",
        "current",
    )?;
    crate::fault::after("current-rename");
    Ok(generation)
}

pub fn install(options: &InstallOptions, release: &VerifiedRelease) -> Result<(), String> {
    let bin = safe_directory(&options.bin, true)?;
    crate::activation::preflight(options, &bin)?;
    let root = managed_directory(&options.root, true)?;
    let existing_objects = existing_managed_child_directory(&root, "objects")?;
    let existing_generations = existing_managed_child_directory(&root, "generations")?;
    let _lock = lock(&root)?;
    if options.dry_run {
        return Ok(());
    }
    crate::activation::ensure(options, &bin)?;
    let objects = match existing_objects {
        Some(directory) => directory,
        None => managed_child_directory(&root, "objects", true)?,
    };
    let generations = match existing_generations {
        Some(directory) => directory,
        None => managed_child_directory(&root, "generations", true)?,
    };
    let object = object_name(&release.digest);
    if entry_exists(&objects, &object)? {
        let mut existing = regular_at(&objects, &object)?;
        if sha256_open_file(&mut existing)?.0 != release.digest {
            return Err("immutable object digest mismatch".to_owned());
        }
    } else {
        write_new_from_file(&objects, &object, &release.artifact)?;
    }
    crate::fault::after("object-create");
    let previous = current_generation(&root)?;
    create_generation(
        &root,
        &generations,
        &release.version,
        &object,
        previous.as_deref(),
    )?;
    Ok(())
}

pub fn rollback(options: &InstallOptions) -> Result<(), String> {
    let root = managed_directory(&options.root, false)?;
    let _lock = lock(&root)?;
    if options.dry_run {
        return Ok(());
    }
    let generations = managed_child_directory(&root, "generations", false)?;
    let current =
        current_generation(&root)?.ok_or("rollback needs an active managed generation")?;
    let (_, previous) = generation_state(&generations, &current)?;
    let previous = previous
        .filter(|value| !value.is_empty())
        .ok_or("rollback needs a retained prior generation")?;
    let (object, _) = generation_state(&generations, &previous)?;
    let bin = safe_directory(&options.bin, false)?;
    crate::activation::ensure(options, &bin)?;
    create_generation(&root, &generations, "rollback", &object, Some(&current))?;
    Ok(())
}

pub fn uninstall(options: &InstallOptions) -> Result<(), String> {
    let root = ManagedRoot::open(&options.root)?;
    let _lock = lock(root.directory())?;
    if options.dry_run {
        return Ok(());
    }
    let bin = safe_directory(&options.bin, false)?;
    crate::activation::preflight(options, &bin)?;
    crate::fault::before("uninstall-activation-commit");
    crate::activation::preflight(options, &bin)?;
    crate::fault::after("uninstall-delete");
    crate::fault::before("uninstall-root-commit");
    root.clear_if_current()?;
    crate::fault::after("uninstall-fsync");
    Ok(())
}
