#[cfg(feature = "test-manager")]
pub fn after(boundary: &str) {
    if std::env::var_os("AI_AUTH_KIT_TEST_FAULT_AT").is_some_and(|value| value == boundary) {
        eprintln!("test fault injected after {boundary}");
        std::process::exit(86);
    }
}

#[cfg(feature = "test-manager")]
pub fn before(boundary: &str) {
    let enabled =
        std::env::var_os("AI_AUTH_KIT_TEST_PAUSE_AT").is_some_and(|value| value == boundary);
    if !enabled {
        return;
    }
    let Some(directory) = std::env::var_os("AI_AUTH_KIT_TEST_PAUSE_DIR") else {
        return;
    };
    let directory = std::path::PathBuf::from(directory);
    let ready = directory.join(format!("{boundary}.ready"));
    let resume = directory.join(format!("{boundary}.resume"));
    if std::fs::write(ready, b"ready\n").is_err() {
        std::process::abort();
    }
    while !resume.exists() {
        std::thread::sleep(std::time::Duration::from_millis(1));
    }
}

#[cfg(not(feature = "test-manager"))]
pub fn after(_: &str) {}

#[cfg(not(feature = "test-manager"))]
pub fn before(_: &str) {}
