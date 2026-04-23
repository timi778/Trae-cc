fn main() {
    // 自动加载 .env 文件中的环境变量
    // 尝试在当前目录、父目录以及更上层目录查找 .env
    let mut current_dir = std::env::current_dir().unwrap();
    loop {
        let env_path = current_dir.join(".env");
        if env_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&env_path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') {
                        continue;
                    }
                    if let Some((key, value)) = line.split_once('=') {
                        let key = key.trim();
                        let value = value.trim().trim_matches('"').trim_matches('\'');
                        if !key.is_empty() {
                            println!("cargo:rustc-env={}={}", key, value);
                        }
                    }
                }
            }
            break;
        }
        if !current_dir.pop() {
            break;
        }
    }
    tauri_build::build();
}
