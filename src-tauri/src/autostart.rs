use std::process::Command;

#[cfg(target_os = "windows")]
pub fn set_auto_start(enabled: bool) -> anyhow::Result<()> {
    use std::env;
    
    let exe_path = env::current_exe()?;
    let exe_path_str = exe_path.to_string_lossy().to_string();
    
    if enabled {
        Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "Trae账号管理",
                "/d",
                &format!("\"{}\" --silent", exe_path_str),
                "/f",
            ])
            .status()?;
    } else {
        Command::new("reg")
            .args(&[
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "Trae账号管理",
                "/f",
            ])
            .status()?;
    }
    
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn set_auto_start(enabled: bool) -> anyhow::Result<()> {
    Ok(())
}
