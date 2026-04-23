use anyhow::{anyhow, Result};
use uuid::Uuid;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(target_os = "windows")]
fn command_no_window(program: &str) -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Windows 注册表中 MachineGuid 的路径
#[cfg(target_os = "windows")]
const MACHINE_GUID_PATH: &str = r"SOFTWARE\Microsoft\Cryptography";
#[cfg(target_os = "windows")]
const MACHINE_GUID_KEY: &str = "MachineGuid";

/// 读取当前系统的 MachineGuid
#[cfg(target_os = "windows")]
pub fn get_machine_guid() -> Result<String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm.open_subkey(MACHINE_GUID_PATH)
        .map_err(|e| anyhow!("无法打开注册表: {}", e))?;

    let guid: String = key.get_value(MACHINE_GUID_KEY)
        .map_err(|e| anyhow!("无法读取 MachineGuid: {}", e))?;

    Ok(guid)
}

/// 设置系统的 MachineGuid（需要管理员权限）
#[cfg(target_os = "windows")]
pub fn set_machine_guid(new_guid: &str) -> Result<()> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm.open_subkey_with_flags(MACHINE_GUID_PATH, KEY_SET_VALUE)
        .map_err(|e| anyhow!("无法打开注册表（需要管理员权限）: {}", e))?;

    key.set_value(MACHINE_GUID_KEY, &new_guid)
        .map_err(|e| anyhow!("无法设置 MachineGuid: {}", e))?;

    Ok(())
}

/// 生成新的 MachineGuid
pub fn generate_machine_guid() -> String {
    Uuid::new_v4().to_string()
}

/// 重置 MachineGuid 为新的随机值
#[cfg(target_os = "windows")]
pub fn reset_machine_guid() -> Result<String> {
    let new_guid = generate_machine_guid();
    set_machine_guid(&new_guid)?;
    Ok(new_guid)
}

/// 获取 Trae IDE 数据目录路径
#[cfg(target_os = "windows")]
pub fn get_trae_data_path() -> Result<PathBuf> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| anyhow!("无法获取 APPDATA 环境变量"))?;
    Ok(PathBuf::from(appdata).join("Trae"))
}

#[cfg(target_os = "macos")]
pub fn get_trae_data_path() -> Result<PathBuf> {
    let home = std::env::var("HOME")
        .map_err(|_| anyhow!("无法获取 HOME 环境变量"))?;
    Ok(PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("Trae"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_trae_data_path() -> Result<PathBuf> {
    Err(anyhow!("此功能仅支持 Windows 和 macOS 系统"))
}

/// 读取 Trae IDE 的机器码
pub fn get_trae_machine_id() -> Result<String> {
    let trae_path = get_trae_data_path()?;
    let machine_id_path = trae_path.join("machineid");

    if !machine_id_path.exists() {
        return Err(anyhow!("Trae IDE 机器码文件不存在"));
    }

    let content = fs::read_to_string(&machine_id_path)
        .map_err(|e| anyhow!("读取 Trae 机器码失败: {}", e))?;

    Ok(content.trim().to_string())
}

/// 设置 Trae IDE 的机器码
pub fn set_trae_machine_id(new_id: &str) -> Result<()> {
    let trae_path = get_trae_data_path()?;
    let machine_id_path = trae_path.join("machineid");

    fs::write(&machine_id_path, new_id)
        .map_err(|e| anyhow!("写入 Trae 机器码失败: {}", e))?;

    Ok(())
}

/// 检查 Trae IDE 是否正在运行
#[cfg(target_os = "windows")]
pub fn is_trae_running() -> bool {
    let output = command_no_window("tasklist")
        .args(["/FI", "IMAGENAME eq Trae.exe", "/NH"])
        .output();

    match output {
        Ok(out) => {
            let result = String::from_utf8_lossy(&out.stdout);
            result.contains("Trae.exe")
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
pub fn is_trae_running() -> bool {
    // 使用 pgrep -f 匹配进程路径中包含 "Trae.app" 的进程
    Command::new("pgrep")
        .args(["-f", "Trae.app/Contents/MacOS"])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn is_trae_running() -> bool {
    false
}

/// 获取 Trae IDE 配置文件路径
fn get_trae_config_path() -> Result<PathBuf> {
    let proj_dirs = directories::ProjectDirs::from("com", "hhj", "trae-cc")
        .ok_or_else(|| anyhow!("无法获取应用数据目录"))?;
    let config_dir = proj_dirs.config_dir();
    fs::create_dir_all(config_dir)?;
    Ok(config_dir.join("trae_path.txt"))
}

/// 获取保存的 Trae IDE 路径
pub fn get_saved_trae_path() -> Result<String> {
    let config_path = get_trae_config_path()?;
    if config_path.exists() {
        let path = fs::read_to_string(&config_path)?;
        let path = path.trim().to_string();
        if !path.is_empty() && PathBuf::from(&path).exists() {
            return Ok(path);
        }
    }
    Err(anyhow!("未设置 Trae IDE 路径"))
}

/// 保存 Trae IDE 路径
#[cfg(target_os = "windows")]
pub fn save_trae_path(path: &str) -> Result<()> {
    let exe_path = PathBuf::from(path);
    if !exe_path.exists() {
        return Err(anyhow!("指定的路径不存在"));
    }
    if !path.to_lowercase().ends_with(".exe") {
        return Err(anyhow!("请选择 Trae.exe 文件"));
    }
    let config_path = get_trae_config_path()?;
    fs::write(&config_path, path)?;
    println!("[INFO] 已保存 Trae IDE 路径: {}", path);
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn save_trae_path(path: &str) -> Result<()> {
    let app_path = PathBuf::from(path);
    if !app_path.exists() {
        return Err(anyhow!("指定的路径不存在"));
    }
    // macOS 应用是 .app bundle 目录
    if !path.to_lowercase().ends_with(".app") {
        return Err(anyhow!("请选择 Trae.app 应用程序"));
    }
    let config_path = get_trae_config_path()?;
    fs::write(&config_path, path)?;
    println!("[INFO] 已保存 Trae IDE 路径: {}", path);
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn save_trae_path(_path: &str) -> Result<()> {
    Err(anyhow!("此功能仅支持 Windows 和 macOS 系统"))
}

/// 自动扫描 Trae IDE 安装路径
#[cfg(target_os = "windows")]
pub fn scan_trae_path() -> Result<String> {
    use std::path::Path;
    
    // 常见的 Windows 安装路径
    let possible_paths = [
        // 用户安装路径
        &format!("{}\\AppData\\Local\\Programs\\Trae\\Trae.exe", std::env::var("LOCALAPPDATA").unwrap_or_default()),
        &format!("{}\\AppData\\Local\\Trae\\Trae.exe", std::env::var("LOCALAPPDATA").unwrap_or_default()),
        // 系统安装路径
        r"C:\Program Files\Trae\Trae.exe",
        r"C:\Program Files (x86)\Trae\Trae.exe",
        // 通过环境变量查找
        &format!("{}\\Trae\\Trae.exe", std::env::var("ProgramFiles").unwrap_or_default()),
        &format!("{}\\Trae\\Trae.exe", std::env::var("ProgramFiles(x86)").unwrap_or_default()),
    ];
    
    for path in possible_paths {
        if Path::new(path).exists() {
            println!("[INFO] 找到 Trae IDE: {}", path);
            return Ok(path.to_string());
        }
    }
    
    // 尝试从注册表查找
    if let Ok(path) = scan_trae_from_registry() {
        return Ok(path);
    }
    
    Err(anyhow!("未找到 Trae IDE，请手动设置路径"))
}

/// 从 Windows 注册表查找 Trae 安装路径
#[cfg(target_os = "windows")]
fn scan_trae_from_registry() -> Result<String> {
    use std::process::Command;
    
    // 尝试从注册表读取
    let reg_paths = [
        r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    ];
    
    for reg_path in &reg_paths {
        let output = Command::new("reg")
            .args(&["query", reg_path, "/s", "/f", "Trae", "/k"])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // 查找包含 InstallLocation 的行
            for line in stdout.lines() {
                if line.contains("InstallLocation") {
                    let parts: Vec<&str> = line.splitn(3, "    ").collect();
                    if parts.len() >= 3 {
                        let install_path = parts[2].trim();
                        let exe_path = format!("{}\\Trae.exe", install_path);
                        if Path::new(&exe_path).exists() {
                            return Ok(exe_path);
                        }
                    }
                }
            }
        }
    }
    
    Err(anyhow!("注册表中未找到 Trae"))
}

#[cfg(target_os = "macos")]
pub fn scan_trae_path() -> Result<String> {
    // 常见的 macOS 应用安装位置
    let possible_paths = [
        "/Applications/Trae.app",
        &format!("{}/Applications/Trae.app", std::env::var("HOME").unwrap_or_default()),
    ];
    
    for path in possible_paths {
        if PathBuf::from(path).exists() {
            return Ok(path.to_string());
        }
    }
    
    Err(anyhow!("未找到 Trae IDE，请手动设置路径"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn scan_trae_path() -> Result<String> {
    Err(anyhow!("此功能仅支持 Windows 和 macOS 系统"))
}

/// 打开 Trae IDE
// macOS 平台实现
#[cfg(target_os = "macos")]
pub fn get_machine_guid() -> Result<String> {
    // 使用 ioreg 命令读取 IOPlatformUUID
    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| anyhow!("执行 ioreg 失败: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // 解析 IOPlatformUUID
    for line in stdout.lines() {
        if line.contains("IOPlatformUUID") {
            // 格式: "IOPlatformUUID" = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            if let Some(uuid) = line.split('"').nth(3) {
                return Ok(uuid.to_string());
            }
        }
    }
    
    Err(anyhow!("无法获取 IOPlatformUUID"))
}

#[cfg(target_os = "macos")]
pub fn set_machine_guid(_new_guid: &str) -> Result<()> {
    // macOS 无法修改系统 UUID
    Err(anyhow!("macOS 不支持修改系统机器码"))
}

#[cfg(target_os = "macos")]
pub fn reset_machine_guid() -> Result<String> {
    // macOS 无法重置系统 UUID
    Err(anyhow!("macOS 不支持重置系统机器码"))
}

// 非 Windows/macOS 平台的占位实现
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_machine_guid() -> Result<String> {
    Err(anyhow!("此功能仅支持 Windows 和 macOS 系统"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn set_machine_guid(_new_guid: &str) -> Result<()> {
    Err(anyhow!("此功能仅支持 Windows 和 macOS 系统"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn reset_machine_guid() -> Result<String> {
    Err(anyhow!("此功能仅支持 Windows 和 macOS 系统"))
}

