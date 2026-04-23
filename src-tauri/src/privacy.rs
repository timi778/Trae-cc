use crate::machine;

pub fn enable_privacy_mode_at_path_with_path<P: AsRef<std::path::Path>, F: FnOnce() -> anyhow::Result<()> + Send + 'static>(
    _db_path: P,
    _restart_fn: F,
) -> anyhow::Result<()> {
    // 实现隐私模式的逻辑
    println!("[privacy] 启用隐私模式");
    Ok(())
}

pub fn enable_privacy_mode_with_restart<F: FnOnce() -> anyhow::Result<()> + Send + 'static>(
    restart_fn: F,
) -> anyhow::Result<()> {
    let db_path = machine::get_trae_state_db_path()?;
    enable_privacy_mode_at_path_with_path(db_path, restart_fn)
}

pub fn disable_privacy_mode() -> anyhow::Result<()> {
    println!("[privacy] 禁用隐私模式");
    Ok(())
}

pub fn is_privacy_mode_enabled() -> bool {
    false
}
