use std::fs::File;
use std::os::unix::fs::MetadataExt;
use std::path::Path;

pub fn managed_directory(path: &Path, create: bool) -> Result<File, String> {
    let directory = crate::fs::safe_directory(path, create)?;
    validate(&directory)?;
    Ok(directory)
}

pub fn managed_child_directory(parent: &File, name: &str, create: bool) -> Result<File, String> {
    let directory = crate::fs::safe_child_directory(parent, name, create)?;
    validate(&directory)?;
    Ok(directory)
}

pub fn existing_managed_child_directory(parent: &File, name: &str) -> Result<Option<File>, String> {
    if !crate::fs::entry_exists(parent, name)? {
        return Ok(None);
    }
    Ok(Some(managed_child_directory(parent, name, false)?))
}

pub fn managed_regular_at(parent: &File, name: &str) -> Result<File, String> {
    let file = crate::fs::regular_at(parent, name)?;
    validate_metadata(&file, false)?;
    Ok(file)
}

fn validate(directory: &File) -> Result<(), String> {
    validate_metadata(directory, true)
}

fn validate_metadata(file: &File, directory: bool) -> Result<(), String> {
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    if (directory && !metadata.is_dir()) || (!directory && !metadata.is_file()) {
        return Err("managed path has an unexpected type".to_owned());
    }
    // SAFETY: geteuid has no arguments and returns the effective UID of this process.
    if metadata.uid() != unsafe { libc::geteuid() } {
        return Err("managed directory is not owned by the current user".to_owned());
    }
    if metadata.mode() & 0o022 != 0 {
        return Err("managed directory is group or world writable".to_owned());
    }
    Ok(())
}
