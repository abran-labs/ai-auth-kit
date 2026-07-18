use std::ffi::CString;
use std::fs::File;
use std::os::fd::AsRawFd;

use crate::fs::{entry_exists, read_link_at};
use crate::state::InstallOptions;

const ACTIVATION_NAME: &str = "ai-auth-kit";

pub fn preflight(options: &InstallOptions, bin: &File) -> Result<(), String> {
    if !entry_exists(bin, ACTIVATION_NAME)? {
        return Ok(());
    }
    let expected = expected_target(options);
    let target = read_link_at(bin, ACTIVATION_NAME).map_err(|_| foreign_activation_error())?;
    if target != expected {
        return Err(foreign_activation_error());
    }
    Ok(())
}

pub fn ensure(options: &InstallOptions, bin: &File) -> Result<(), String> {
    preflight(options, bin)?;
    if create_activation(bin, &expected_target(options))? {
        return Ok(());
    }
    preflight(options, bin)
}

fn create_activation(bin: &File, target: &str) -> Result<bool, String> {
    let target = CString::new(target).map_err(|_| "path contains NUL".to_owned())?;
    let name = CString::new(ACTIVATION_NAME).map_err(|_| "path contains NUL".to_owned())?;
    crate::fault::before("activation-commit");
    // SAFETY: category 8 FFI; `bin` is a held directory fd and both C strings are NUL-terminated.
    if unsafe { libc::symlinkat(target.as_ptr(), bin.as_raw_fd(), name.as_ptr()) } != 0 {
        return match std::io::Error::last_os_error().raw_os_error() {
            Some(libc::EEXIST) => Ok(false),
            _ => Err(std::io::Error::last_os_error().to_string()),
        };
    }
    crate::fault::after("activation-create");
    bin.sync_all().map_err(|error| error.to_string())?;
    crate::fault::after("activation-rename");
    crate::fault::after("activation-fsync");
    Ok(true)
}

pub fn expected_target(options: &InstallOptions) -> String {
    format!("{}/current/{ACTIVATION_NAME}", options.root.display())
}

pub fn foreign_activation_error() -> String {
    "foreign activation exists; --force never replaces or removes foreign activation".to_owned()
}
