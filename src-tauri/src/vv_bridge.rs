use anyhow::{anyhow, Result};
use crate::account::Account;
use serde::{Deserialize, Serialize};
use std::ffi::{c_char, CStr, CString};

#[derive(Debug, Serialize)]
struct ExecuteRequest {
    account_id: String,
    mode: String,
    force: bool,
    auto_start: bool,
}

#[derive(Debug, Serialize)]
struct ControlRequest {
    action: String,
    restart_if_running: bool,
}

#[derive(Debug, Deserialize)]
struct ExecuteResponse {
    ok: bool,
    code: String,
    message: String,
    #[serde(default)]
    skipped: bool,
    #[serde(default)]
    data: Option<serde_json::Value>,
}

#[cfg(target_os = "windows")]
fn invoke_vv_function<T: Serialize>(
    func: unsafe extern "C" fn(*const c_char) -> *mut c_char,
    request: &T,
) -> Result<ExecuteResponse> {
    let request_json = serde_json::to_string(request)?;
    let request_cstr =
        CString::new(request_json).map_err(|e| anyhow!("请求序列化后包含非法空字节: {}", e))?;
    
    unsafe {
        let response_ptr = func(request_cstr.as_ptr());
        if response_ptr.is_null() {
            return Err(anyhow!("Trae-vv 返回空响应"));
        }

        let response_json = CStr::from_ptr(response_ptr).to_string_lossy().into_owned();
        trae_vv::trae_vv_free_string(response_ptr);

        serde_json::from_str(&response_json).map_err(|e| anyhow!("解析 Trae-vv 响应失败: {}", e))
    }
}

#[cfg(not(target_os = "windows"))]
fn not_supported() -> Result<bool> {
    Err(anyhow!("Trae-vv 仅支持 Windows"))
}

pub fn execute_account_flow(
    account_id: &str,
    mode: &str,
    force: bool,
    auto_start: bool,
) -> Result<bool> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (account_id, mode, force, auto_start);
        return not_supported();
    }

    #[cfg(target_os = "windows")]
    {
    let request = ExecuteRequest {
        account_id: account_id.to_string(),
        mode: mode.to_string(),
        force,
        auto_start,
    };

    let response = invoke_vv_function(trae_vv::trae_vv_execute, &request)?;

    if response.ok {
        log::info!(
            "Trae-vv execute success: mode={}, code={}, skipped={}",
            mode,
            response.code,
            response.skipped
        );
        Ok(response.skipped)
    } else {
        Err(anyhow!(
            "Trae-vv 执行失败: code={}, message={}",
            response.code,
            response.message
        ))
    }
    }
}

pub fn sync_current_account(restart_if_running: bool) -> Result<bool> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = restart_if_running;
        return not_supported();
    }

    #[cfg(target_os = "windows")]
    {
    let request = ControlRequest {
        action: "sync_current_account".to_string(),
        restart_if_running,
    };

    let response = invoke_vv_function(trae_vv::trae_vv_control, &request)?;
    if response.ok {
        log::info!(
            "Trae-vv control success: action=sync_current_account, code={}, skipped={}",
            response.code,
            response.skipped
        );
        Ok(response.skipped)
    } else {
        Err(anyhow!(
            "Trae-vv 控制失败: code={}, message={}",
            response.code,
            response.message
        ))
    }
    }
}

pub fn clear_login_state() -> Result<()> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err(anyhow!("Trae-vv 仅支持 Windows"));
    }

    #[cfg(target_os = "windows")]
    {
    let request = ControlRequest {
        action: "clear_login_state".to_string(),
        restart_if_running: false,
    };

    let response = invoke_vv_function(trae_vv::trae_vv_control, &request)?;
    if response.ok {
        log::info!(
            "Trae-vv control success: action=clear_login_state, code={}",
            response.code
        );
        Ok(())
    } else {
        Err(anyhow!(
            "Trae-vv 控制失败: code={}, message={}",
            response.code,
            response.message
        ))
    }
    }
}

pub fn read_trae_account() -> Result<Option<Account>> {
    #[cfg(not(target_os = "windows"))]
    {
        return Ok(None);
    }

    #[cfg(target_os = "windows")]
    {
    let request = ControlRequest {
        action: "read_trae_account".to_string(),
        restart_if_running: false,
    };

    let response = invoke_vv_function(trae_vv::trae_vv_control, &request)?;
    if response.ok {
        if let Some(data) = response.data {
            let account: Option<Account> = serde_json::from_value(data)?;
            return Ok(account);
        }
        Ok(None)
    } else {
        Err(anyhow!(
            "Trae-vv 控制失败: code={}, message={}",
            response.code,
            response.message
        ))
    }
    }
}
