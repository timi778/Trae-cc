use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

static LOG_FILE: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn init_logger() -> anyhow::Result<()> {
    let log_path = get_log_file_path();
    
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)?;
    }
    
    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{} [{}] {}",
                chrono::Local::now().format("[%Y-%m-%d %H:%M:%S]"),
                record.level(),
                message
            ))
        })
        .level(log::LevelFilter::Info)
        .chain(fern::log_file(&log_path)?)
        .chain(std::io::stdout())
        .apply()?;
    
    if let Ok(mut path) = LOG_FILE.lock() {
        *path = Some(log_path);
    }
    
    Ok(())
}

pub fn log_panic(info: &std::panic::PanicHookInfo) {
    log::error!("Panic: {}", info);
}

pub fn get_recent_logs(count: usize) -> anyhow::Result<Vec<String>> {
    let path = get_log_file_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&path)?;
    let lines: Vec<String> = content
        .lines()
        .map(|l| l.to_string())
        .rev()
        .take(count)
        .collect();
    
    Ok(lines.into_iter().rev().collect())
}

pub fn export_logs(dest: &PathBuf) -> anyhow::Result<()> {
    let path = get_log_file_path();
    if path.exists() {
        fs::copy(&path, dest)?;
    }
    Ok(())
}

pub fn clear_logs() -> anyhow::Result<()> {
    let path = get_log_file_path();
    if path.exists() {
        fs::write(&path, "")?;
    }
    Ok(())
}

pub fn get_log_file_path() -> PathBuf {
    let proj_dirs = directories::ProjectDirs::from("com", "hhj", "trae-cc")
        .expect("无法获取配置目录");
    proj_dirs.data_dir().join("logs").join("trae-cc.log")
}

pub fn get_log_file_path_str() -> String {
    get_log_file_path().to_string_lossy().to_string()
}
