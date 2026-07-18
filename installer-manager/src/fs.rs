use std::ffi::CString;
use std::fs::File;
use std::io::{Read, Write};
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::path::Path;

const RESOLVE_NO_MAGICLINKS: u64 = 0x02;
const RESOLVE_NO_SYMLINKS: u64 = 0x04;
const RESOLVE_BENEATH: u64 = 0x08;

#[repr(C)]
struct OpenHow {
    flags: u64,
    mode: u64,
    resolve: u64,
}

fn cstring(name: &str) -> Result<CString, String> {
    CString::new(name).map_err(|_| "path contains NUL".to_owned())
}
fn io(error: std::io::Error) -> String {
    error.to_string()
}

pub fn safe_directory(path: &Path, create: bool) -> Result<File, String> {
    if !path.is_absolute() {
        return Err("managed root must be absolute".to_owned());
    }
    let mut current = File::open("/").map_err(io)?;
    for component in path.components() {
        let name = match component {
            std::path::Component::RootDir => continue,
            std::path::Component::Normal(name) => name,
            std::path::Component::CurDir | std::path::Component::ParentDir => {
                return Err("managed root contains dot component".to_owned());
            }
            std::path::Component::Prefix(_) => {
                return Err("managed root has unsupported prefix".to_owned());
            }
        };
        let name = name.to_str().ok_or("non-UTF-8 managed path")?;
        let fd = open_directory(current.as_raw_fd(), name, create)?;
        // SAFETY: openat returns a new owned descriptor on success.
        current = unsafe { File::from(OwnedFd::from_raw_fd(fd)) };
    }
    Ok(current)
}

pub fn safe_child_directory(parent: &File, name: &str, create: bool) -> Result<File, String> {
    let fd = open_directory(parent.as_raw_fd(), name, create)?;
    // SAFETY: `open_directory` returns a newly owned descriptor on success.
    Ok(unsafe { File::from(OwnedFd::from_raw_fd(fd)) })
}

fn open_directory(parent: i32, name: &str, create: bool) -> Result<i32, String> {
    let name = cstring(name)?;
    let flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let fd = open_child(parent, &name, flags, 0);
    if fd >= 0 {
        return Ok(fd);
    }
    if !create {
        return Err(std::io::Error::last_os_error().to_string());
    }
    // SAFETY: mkdirat only reads the held descriptor and CString.
    if unsafe { libc::mkdirat(parent, name.as_ptr(), 0o700) } != 0
        && std::io::Error::last_os_error().raw_os_error() != Some(libc::EEXIST)
    {
        return Err(std::io::Error::last_os_error().to_string());
    }
    let created = open_child(parent, &name, flags, 0);
    if created < 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    Ok(created)
}

fn open_child(parent: i32, name: &CString, flags: i32, mode: libc::mode_t) -> i32 {
    let how = OpenHow {
        flags: u64::try_from(flags).unwrap_or_default(),
        mode: u64::from(mode),
        resolve: RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS,
    };
    // SAFETY: category 8 FFI; `parent` is a live dirfd and `name` is NUL-terminated.
    let result = unsafe {
        libc::syscall(
            libc::SYS_openat2,
            parent,
            name.as_ptr(),
            &how,
            std::mem::size_of::<OpenHow>(),
        )
    };
    if result >= 0 {
        return i32::try_from(result).unwrap_or(-1);
    }
    let error = std::io::Error::last_os_error().raw_os_error();
    if !matches!(error, Some(libc::ENOSYS) | Some(libc::EINVAL)) {
        return -1;
    }
    // SAFETY: category 8 FFI; fallback walks one validated component under held dirfd.
    unsafe { libc::openat(parent, name.as_ptr(), flags, mode) }
}

pub fn regular_at(parent: &File, name: &str) -> Result<File, String> {
    let name = cstring(name)?;
    // SAFETY: held directory fd and CString are valid; O_NONBLOCK prevents FIFO blocking.
    let fd = unsafe {
        libc::openat(
            parent.as_raw_fd(),
            name.as_ptr(),
            libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_NONBLOCK | libc::O_CLOEXEC,
        )
    };
    if fd < 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    // SAFETY: fd is returned by openat and owned by this function.
    let file = unsafe { File::from(OwnedFd::from_raw_fd(fd)) };
    if !file.metadata().map_err(io)?.is_file() {
        return Err("expected regular file".to_owned());
    }
    Ok(file)
}

fn create_new(parent: &File, name: &str) -> Result<File, String> {
    let name = cstring(name)?;
    // SAFETY: held directory descriptor and CString are valid; O_EXCL prevents replacement.
    let fd = unsafe {
        libc::openat(
            parent.as_raw_fd(),
            name.as_ptr(),
            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            0o700,
        )
    };
    if fd < 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    // SAFETY: `openat` returned a uniquely owned descriptor.
    Ok(unsafe { File::from(OwnedFd::from_raw_fd(fd)) })
}

pub fn write_new_from_file(parent: &File, name: &str, source: &File) -> Result<(), String> {
    let mut output = create_new(parent, name)?;
    let mut input = source.try_clone().map_err(io)?;
    use std::io::{Seek, SeekFrom};
    input.seek(SeekFrom::Start(0)).map_err(io)?;
    let mut bytes = [0_u8; 65_536];
    loop {
        let count = input.read(&mut bytes).map_err(io)?;
        if count == 0 {
            break;
        }
        output.write_all(&bytes[..count]).map_err(io)?;
    }
    crate::fault::after("artifact-copy");
    output.sync_all().map_err(io)?;
    crate::fault::after("artifact-fsync");
    Ok(())
}

pub fn write_new_bytes(parent: &File, name: &str, bytes: &[u8], mode: u32) -> Result<(), String> {
    let mut output = create_new(parent, name)?;
    output.write_all(bytes).map_err(io)?;
    // SAFETY: `fchmod` acts only on this owned descriptor and accepts the supplied mode bits.
    if unsafe { libc::fchmod(output.as_raw_fd(), mode) } != 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    output.sync_all().map_err(io)
}

pub fn symlink_replace(
    parent: &File,
    temporary: &str,
    target: &str,
    current: &str,
    fault_prefix: &str,
) -> Result<(), String> {
    if entry_exists(parent, temporary)? {
        remove_at(parent, temporary, false)?;
    }
    let temporary = cstring(temporary)?;
    let target = cstring(target)?;
    let current = cstring(current)?;
    // SAFETY: all strings are NUL-terminated and parent is held.
    if unsafe { libc::symlinkat(target.as_ptr(), parent.as_raw_fd(), temporary.as_ptr()) } != 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    crate::fault::after(&format!("{fault_prefix}-create"));
    // SAFETY: both names are relative to the same held directory, so rename is atomic there.
    if unsafe {
        libc::renameat(
            parent.as_raw_fd(),
            temporary.as_ptr(),
            parent.as_raw_fd(),
            current.as_ptr(),
        )
    } != 0
    {
        return Err(std::io::Error::last_os_error().to_string());
    }
    crate::fault::after(&format!("{fault_prefix}-rename"));
    parent.sync_all().map_err(io)?;
    crate::fault::after(&format!("{fault_prefix}-fsync"));
    Ok(())
}

pub fn remove_at(parent: &File, name: &str, directory: bool) -> Result<(), String> {
    let name = cstring(name)?;
    let flag = if directory { libc::AT_REMOVEDIR } else { 0 };
    // SAFETY: deletion stays beneath held parent descriptor and cannot traverse a supplied path.
    if unsafe { libc::unlinkat(parent.as_raw_fd(), name.as_ptr(), flag) } != 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    parent.sync_all().map_err(io)
}

pub fn read_link_at(parent: &File, name: &str) -> Result<String, String> {
    let name = cstring(name)?;
    let mut bytes = vec![0_u8; 4096];
    // SAFETY: the buffer is writable for its declared size, the parent is held, and the name is NUL-terminated.
    let count = unsafe {
        libc::readlinkat(
            parent.as_raw_fd(),
            name.as_ptr(),
            bytes.as_mut_ptr().cast(),
            bytes.len(),
        )
    };
    if count < 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    let length = usize::try_from(count).map_err(|_| "invalid link length")?;
    if length == bytes.len() {
        return Err("symlink target is too long".to_owned());
    }
    bytes.truncate(length);
    String::from_utf8(bytes).map_err(|_| "symlink target is not UTF-8".to_owned())
}

pub fn entry_exists(parent: &File, name: &str) -> Result<bool, String> {
    let name = cstring(name)?;
    let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
    // SAFETY: `stat` points to uninitialized storage large enough for libc to fill; no Rust reads occur before success.
    let result = unsafe {
        libc::fstatat(
            parent.as_raw_fd(),
            name.as_ptr(),
            stat.as_mut_ptr(),
            libc::AT_SYMLINK_NOFOLLOW,
        )
    };
    if result == 0 {
        return Ok(true);
    }
    match std::io::Error::last_os_error().raw_os_error() {
        Some(libc::ENOENT) => Ok(false),
        _ => Err(std::io::Error::last_os_error().to_string()),
    }
}

pub fn remove_tree_at(parent: &File, name: &str) -> Result<(), String> {
    match crate::directory::managed_child_directory(parent, name, false) {
        Ok(child) => {
            let directory = format!("/proc/self/fd/{}", child.as_raw_fd());
            let entries = std::fs::read_dir(directory).map_err(io)?;
            for entry in entries {
                let entry = entry.map_err(io)?;
                let child_name = entry.file_name();
                let child_name = child_name.to_str().ok_or("managed entry is not UTF-8")?;
                remove_tree_at(&child, child_name)?;
            }
            remove_at(parent, name, true)
        }
        Err(error) => match read_link_at(parent, name) {
            Ok(target)
                if target.starts_with("generations/") || target.starts_with("../../objects/") =>
            {
                remove_at(parent, name, false)
            }
            _ => match crate::directory::managed_regular_at(parent, name) {
                Ok(_) => remove_at(parent, name, false),
                Err(_) => Err(error),
            },
        },
    }
}
