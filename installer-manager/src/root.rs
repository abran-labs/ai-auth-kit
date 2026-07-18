use std::ffi::CString;
use std::fs::File;
use std::os::fd::AsRawFd;
use std::os::unix::fs::MetadataExt;
use std::path::Path;

use crate::directory::managed_child_directory;
use crate::fs::{remove_tree_at, safe_directory};

pub struct ManagedRoot {
    parent: File,
    directory: File,
    name: CString,
}

impl ManagedRoot {
    pub fn open(path: &Path) -> Result<Self, String> {
        let parent_path = path.parent().ok_or("managed root has no parent")?;
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or("managed root name is malformed")?;
        let parent = safe_directory(parent_path, false)?;
        let directory = managed_child_directory(&parent, name, false)?;
        let name = CString::new(name).map_err(|_| "path contains NUL".to_owned())?;
        Ok(Self {
            parent,
            directory,
            name,
        })
    }

    pub fn directory(&self) -> &File {
        &self.directory
    }

    pub fn clear_if_current(&self) -> Result<(), String> {
        let expected = self
            .directory
            .metadata()
            .map_err(|error| error.to_string())?;
        let mut actual = std::mem::MaybeUninit::<libc::stat>::uninit();
        // SAFETY: category 8 FFI; `parent` is held, `name` is NUL-terminated,
        // and libc initializes `actual` before its fields are read on success.
        let result = unsafe {
            libc::fstatat(
                self.parent.as_raw_fd(),
                self.name.as_ptr(),
                actual.as_mut_ptr(),
                libc::AT_SYMLINK_NOFOLLOW,
            )
        };
        if result != 0 {
            return Err("managed root changed before uninstall commit".to_owned());
        }
        // SAFETY: fstatat returned success, so libc initialized every field of stat.
        let actual = unsafe { actual.assume_init() };
        if actual.st_dev != expected.dev() || actual.st_ino != expected.ino() {
            return Err("managed root changed before uninstall commit".to_owned());
        }
        let directory = format!("/proc/self/fd/{}", self.directory.as_raw_fd());
        for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let name = entry.file_name();
            let name = name.to_str().ok_or("managed entry is not UTF-8")?;
            remove_tree_at(&self.directory, name)?;
        }
        self.directory.sync_all().map_err(|error| error.to_string())
    }
}
