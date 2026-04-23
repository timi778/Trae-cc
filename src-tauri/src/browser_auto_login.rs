use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use crate::AppState;
use crate::ApiError;

pub async fn browser_auto_login(
    app: AppHandle,
    email: String,
    password: String,
    state: &tauri::State<'_, AppState>,
) -> Result<crate::Account, ApiError> {
    println!("[browser_auto_login] 开始自动登录: {}", email);
    
    // 关闭已存在的窗口
    if let Some(existing) = app.get_webview_window("auto_login") {
        let _ = existing.destroy();
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    
    let webview = WebviewWindowBuilder::new(
        &app,
        "auto_login",
        WebviewUrl::External("https://www.trae.ai/login".parse().unwrap()),
    )
    .title("Trae 自动登录")
    .inner_size(1000.0, 720.0)
    .build()
    .map_err(|e| ApiError::from(anyhow::anyhow!("无法打开登录窗口: {}", e)))?;
    
    // 等待页面加载
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    
    // 注入登录脚本
    let script = format!(
        r#"
        (function() {{
            const emailInput = document.querySelector('input[type="email"], input[name="email"]');
            const passwordInput = document.querySelector('input[type="password"], input[name="password"]');
            
            if (emailInput) {{
                emailInput.value = "{}";
                emailInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }}
            
            if (passwordInput) {{
                passwordInput.value = "{}";
                passwordInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }}
            
            const submitBtn = document.querySelector('button[type="submit"], .btn-submit');
            if (submitBtn) {{
                submitBtn.click();
            }}
        }})();
        "#,
        email, password
    );
    
    // 保存账号
    println!("[browser-auto-login] 保存账号...");
    let mut manager = state.account_manager.lock().await;
    
    // 获取 cookies
    let _cookies = webview.cookies()
        .map(|cookies: Vec<tauri::webview::Cookie>| {
            cookies.iter()
                .map(|c| format!("{}={}", c.name(), c.value()))
                .collect::<Vec<_>>()
                .join("; ")
        })
        .unwrap_or_default();
    
    let _ = webview.close();
    
    // 这里需要实现获取账号信息的逻辑
    Err(ApiError::from(anyhow::anyhow!("自动登录功能待完善")))
}
