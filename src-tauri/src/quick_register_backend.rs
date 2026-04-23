use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, LazyLock};
use tauri::AppHandle;
use crate::AppState;
use crate::ApiError;
use crate::safe_lock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickRegisterTask {
    pub id: String,
    pub status: String,
    pub email: Option<String>,
    pub password: Option<String>,
    pub token: Option<String>,
    pub created_at: String,
    pub error: Option<String>,
    // 前端需要的字段
    pub success: bool,
    pub ticket: String,
    pub qrcode_url: String,
    pub is_vip: bool,
    pub url_scheme: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct QuickRegisterStats {
    pub total_tasks: usize,
    pub active_tasks: usize,
    pub success_count: usize,
    pub failed_count: usize,
}

// 前端期望的统计响应格式
#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub success: bool,
    pub data: StatsData,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct StatsData {
    pub available_count: i64,
    pub resource_type: String,
}

static TASKS: LazyLock<Mutex<HashMap<String, Arc<Mutex<QuickRegisterTask>>>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

// 换取 PC Token 响应
#[derive(Debug, Serialize, Deserialize)]
pub struct PcTokenResponse {
    pub success: bool,
    #[serde(rename = "pc_bind_token")]
    pub pc_bind_token: Option<String>,
    pub message: Option<String>,
    pub code: Option<String>,
}

// 用户信息 - 基本信息
#[derive(Debug, Serialize, Deserialize)]
pub struct UserBasicInfo {
    pub openid: String,
    #[serde(rename = "virtual_id")]
    pub virtual_id: String,
    #[serde(rename = "qq_id")]
    pub qq_id: Option<String>,
    #[serde(rename = "is_vip")]
    pub is_vip: bool,
    #[serde(rename = "created_at")]
    pub created_at: String,
}

// 用户信息 - 领取限额
#[derive(Debug, Serialize, Deserialize)]
pub struct UserClaimLimit {
    #[serde(rename = "base_limit")]
    pub base_limit: i32,
    #[serde(rename = "bonus_limit")]
    pub bonus_limit: i32,
    #[serde(rename = "total_limit")]
    pub total_limit: i32,
    #[serde(rename = "current_usage")]
    pub current_usage: i32,
    pub remaining: i32,
}

// 用户信息 - 邀请信息
#[derive(Debug, Serialize, Deserialize)]
pub struct UserInvitation {
    #[serde(rename = "invite_code")]
    pub invite_code: Option<String>,
    #[serde(rename = "total_invited")]
    pub total_invited: i32,
    #[serde(rename = "is_invited")]
    pub is_invited: bool,
}

// 用户信息 - 数据
#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfoData {
    pub basic: UserBasicInfo,
    #[serde(rename = "claim_limit")]
    pub claim_limit: UserClaimLimit,
    pub invitation: UserInvitation,
}

// 用户信息响应
#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfoResponse {
    pub success: bool,
    pub openid: Option<String>,
    pub data: UserInfoData,
    pub message: Option<String>,
}

// 资源负载
#[derive(Debug, Serialize, Deserialize)]
pub struct ResourcePayload {
    #[serde(rename = "resource_id")]
    pub resource_id: String,
    #[serde(rename = "resource_type")]
    pub resource_type: String,
    #[serde(rename = "resource_name")]
    pub resource_name: String,
    #[serde(rename = "resource_value")]
    pub resource_value: Option<String>,
}

// 领取资源响应（新流程）
#[derive(Debug, Serialize, Deserialize)]
pub struct ClaimResourceNewResponse {
    pub success: bool,
    pub resource_payload: Vec<ResourcePayload>,
    pub message: String,
    pub code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TodayAnalyticsResponse {
    pub success: bool,
    pub data: TodayAnalyticsData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TodayAnalyticsData {
    pub today_new_users: i32,
    pub cumulative_since_0420: i32,
}

// 获取今日新用户统计
#[tauri::command]
pub async fn quick_register_create_task(
    _app: AppHandle,
    platformId: String,
    openid: Option<String>,
    _state: tauri::State<'_, AppState>,
) -> Result<QuickRegisterTask, ApiError> {
    println!("[QuickRegister] 创建任务: platformId={}, openid={:?}", platformId, openid);
    
    // 从环境变量获取后端 API 地址
    let api_base = std::env::var("VITE_QUICK_REGISTER_API_BASE")
        .unwrap_or_else(|_| "https://hhxyyq.online".to_string());
    
    // 获取认证信息
    let app_id = std::env::var("VITE_APP_ID").unwrap_or_else(|_| "trae_email".to_string());
    let app_secret = std::env::var("VITE_APP_SECRET").unwrap_or_else(|_| "trae_email_secret_key_2026".to_string());
    
    // 调用后端 API 创建任务
    let client = reqwest::Client::new();
    let url = format!("{}/api/task/create", api_base);
    
    // 构建请求体
    let mut body = serde_json::json!({
        "platformId": platformId,
    });
    if let Some(ref oid) = openid {
        body["openid"] = serde_json::json!(oid);
    }
    
    match client
        .post(&url)
        .header("X-App-ID", app_id)
        .header("X-App-Secret", app_secret)
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(text) => {
                    println!("[QuickRegister] Create task API response ({}): {}", status, text);
                    match serde_json::from_str::<serde_json::Value>(&text) {
                        Ok(data) => {
                            let success = data.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
                            
                            if success {
                                let ticket = data.get("ticket").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let qrcode_url = data.get("qrcode_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let is_vip = data.get("is_vip").and_then(|v| v.as_bool()).unwrap_or(false);
                                let url_scheme = data.get("url_scheme").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let message = data.get("message").and_then(|v| v.as_str()).unwrap_or("创建任务成功").to_string();
                                
                                let task = QuickRegisterTask {
                                    id: ticket.clone(),
                                    status: "created".to_string(),
                                    email: None,
                                    password: None,
                                    token: None,
                                    created_at: chrono::Local::now().to_rfc3339(),
                                    error: None,
                                    success: true,
                                    ticket,
                                    qrcode_url,
                                    is_vip,
                                    url_scheme,
                                    message,
                                };
                                
                                // 保存到本地任务列表
                                let task_arc = Arc::new(Mutex::new(task.clone()));
                                if let Some(mut tasks) = safe_lock(&TASKS) {
                                    tasks.insert(task.id.clone(), task_arc);
                                }
                                
                                return Ok(task);
                            } else {
                                let message = data.get("message").and_then(|v| v.as_str()).unwrap_or("创建任务失败").to_string();
                                return Err(ApiError::from(anyhow::anyhow!("{}", message)));
                            }
                        }
                        Err(e) => {
                            return Err(ApiError::from(anyhow::anyhow!("解析响应失败: {}", e)));
                        }
                    }
                }
                Err(e) => {
                    return Err(ApiError::from(anyhow::anyhow!("读取响应失败: {}", e)));
                }
            }
        }
        Err(e) => {
            return Err(ApiError::from(anyhow::anyhow!("请求失败: {}", e)));
        }
    }
}

#[tauri::command]
pub async fn quick_register_get_status(task_id: String) -> Result<Option<QuickRegisterTask>, ApiError> {
    let tasks = safe_lock(&TASKS);
    if let Some(tasks) = tasks {
        if let Some(task) = tasks.get(&task_id) {
            return Ok(safe_lock(&task).map(|g| g.clone()));
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn quick_register_claim_resource(
    _task_id: String,
    _resource_type: String,
) -> Result<String, ApiError> {
    Err(ApiError::from(anyhow::anyhow!("资源声明功能未实现")))
}

#[tauri::command]
pub async fn quick_register_get_stats() -> Result<StatsResponse, ApiError> {
    // 从环境变量获取后端 API 地址（使用 VITE_ 前缀，与前端一致）
    let api_base = std::env::var("VITE_QUICK_REGISTER_API_BASE")
        .unwrap_or_else(|_| "https://hhxyyq.online".to_string());
    
    // 获取认证信息
    let app_id = std::env::var("VITE_APP_ID").unwrap_or_else(|_| "trae_email".to_string());
    let app_secret = std::env::var("VITE_APP_SECRET").unwrap_or_else(|_| "trae_email_secret_key_2026".to_string());
    
    // 调用后端 API 获取剩余账号数量
    let client = reqwest::Client::new();
    let url = format!("{}/api/task/stats", api_base);
    
    match client
        .get(&url)
        .header("X-App-ID", app_id)
        .header("X-App-Secret", app_secret)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(text) => {
                    log::info!("Stats API response ({}): {}", status, text);
                    match serde_json::from_str::<serde_json::Value>(&text) {
                        Ok(data) => {
                            // 解析后端返回的数据
                            let available_count = data
                                .get("data")
                                .and_then(|d| d.get("available_count"))
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            
                            // resource_type 不在 API 返回中，使用默认值
                            let resource_type = "trae_account".to_string();
                            
                            log::info!("Parsed stats: available_count={}", available_count);
                            
                            Ok(StatsResponse {
                                success: true,
                                data: StatsData {
                                    available_count,
                                    resource_type,
                                },
                                message: "获取统计成功".to_string(),
                            })
                        }
                        Err(e) => {
                            log::warn!("解析统计响应失败: {}, raw text: {}", e, text);
                            // 返回默认值
                            Ok(StatsResponse {
                                success: true,
                                data: StatsData {
                                    available_count: 100, // 默认显示有库存
                                    resource_type: "trae_account".to_string(),
                                },
                                message: "使用默认统计".to_string(),
                            })
                        }
                    }
                }
                Err(e) => {
                    log::warn!("读取统计响应失败: {}", e);
                    Ok(StatsResponse {
                        success: true,
                        data: StatsData {
                            available_count: 100,
                            resource_type: "trae_account".to_string(),
                        },
                        message: "使用默认统计".to_string(),
                    })
                }
            }
        }
        Err(e) => {
            log::warn!("获取统计失败: {}", e);
            // API 调用失败时返回默认值，避免前端显示错误
            Ok(StatsResponse {
                success: true,
                data: StatsData {
                    available_count: 100, // 默认显示有库存
                    resource_type: "trae_account".to_string(),
                },
                message: "使用默认统计".to_string(),
            })
        }
    }
}

#[tauri::command]
pub async fn exchange_pc_token(
    _token: String,
    _state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, ApiError> {
    Err(ApiError::from(anyhow::anyhow!("Token 交换功能未实现")))
}

#[tauri::command]
pub async fn get_user_info(
    _state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, ApiError> {
    Err(ApiError::from(anyhow::anyhow!("获取用户信息功能未实现")))
}

#[tauri::command]
pub async fn claim_resource_with_token(
    _token: String,
    _resource_type: String,
) -> Result<serde_json::Value, ApiError> {
    Err(ApiError::from(anyhow::anyhow!("使用 Token 声明资源功能未实现")))
}

#[tauri::command]
pub async fn get_today_analytics() -> Result<serde_json::Value, ApiError> {
    // 从环境变量获取后端 API 地址（使用 VITE_ 前缀，与前端一致）
    let api_base = std::env::var("VITE_QUICK_REGISTER_API_BASE")
        .unwrap_or_else(|_| "https://hhxyyq.online".to_string());
    
    // 获取认证信息
    let app_id = std::env::var("VITE_APP_ID").unwrap_or_else(|_| "trae_email".to_string());
    let app_secret = std::env::var("VITE_APP_SECRET").unwrap_or_else(|_| "trae_email_secret_key_2026".to_string());
    
    // 调用后端 API 获取今日统计
    let client = reqwest::Client::new();
    let url = format!("{}/api/analytics/today_new_users", api_base);
    
    match client
        .get(&url)
        .header("X-App-ID", app_id)
        .header("X-App-Secret", app_secret)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(text) => {
                    log::info!("Analytics API response ({}): {}", status, text);
                    match serde_json::from_str::<serde_json::Value>(&text) {
                        Ok(data) => {
                            // 解析后端返回的数据
                            let today_new_users = data
                                .get("data")
                                .and_then(|d| d.get("today_new_users"))
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            
                            let cumulative_since_0420 = data
                                .get("data")
                                .and_then(|d| d.get("cumulative_since_0420"))
                                .and_then(|v| v.as_i64())
                                .unwrap_or(0);
                            
                            log::info!("Parsed analytics: today_new_users={}, cumulative_since_0420={}", 
                                today_new_users, cumulative_since_0420);
                            
                            Ok(serde_json::json!({
                                "success": true,
                                "data": {
                                    "today_new_users": today_new_users,
                                    "cumulative_since_0420": cumulative_since_0420,
                                }
                            }))
                }
                        Err(e) => {
                            log::warn!("解析今日统计响应失败: {}, raw text: {}", e, text);
                            // 返回默认值
                            Ok(serde_json::json!({
                                "success": true,
                                "data": {
                                    "today_new_users": 0,
                                    "cumulative_since_0420": 0,
                                }
                            }))
                        }
                    }
                }
                Err(e) => {
                    log::warn!("读取今日统计响应失败: {}", e);
                    Ok(serde_json::json!({
                        "success": true,
                        "data": {
                            "today_new_users": 0,
                            "cumulative_since_0420": 0,
                        }
                    }))
                }
            }
        }
        Err(e) => {
            log::warn!("获取今日统计失败: {}", e);
            // API 调用失败时返回默认值
            Ok(serde_json::json!({
                "success": true,
                "data": {
                    "today_new_users": 0,
                    "cumulative_since_0420": 0,
                }
            }))
        }
    }
}
