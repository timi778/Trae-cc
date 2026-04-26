use std::ffi::{c_char, CStr, CString};

fn make_error_response(message: &str) -> *mut c_char {
    let payload = serde_json::json!({
        "ok": false,
        "code": "UNSUPPORTED",
        "message": message,
        "skipped": false,
        "data": null
    });
    let json = payload.to_string();
    CString::new(json)
        .unwrap_or_else(|_| CString::new("{\"ok\":false,\"code\":\"UNSUPPORTED\",\"message\":\"invalid response\"}").unwrap())
        .into_raw()
}

#[no_mangle]
pub unsafe extern "C" fn trae_vv_execute(_request_json: *const c_char) -> *mut c_char {
    make_error_response("trae-vv 未安装/未启用（stub）")
}

#[no_mangle]
pub unsafe extern "C" fn trae_vv_control(_request_json: *const c_char) -> *mut c_char {
    make_error_response("trae-vv 未安装/未启用（stub）")
}

#[no_mangle]
pub unsafe extern "C" fn trae_vv_free_string(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    let _ = CString::from_raw(ptr);
}

#[no_mangle]
pub unsafe extern "C" fn trae_vv_version() -> *mut c_char {
    CString::new("stub-0.1.0").unwrap().into_raw()
}

#[no_mangle]
pub unsafe extern "C" fn trae_vv_echo(request_json: *const c_char) -> *mut c_char {
    if request_json.is_null() {
        return make_error_response("null request");
    }
    let request = CStr::from_ptr(request_json).to_string_lossy().into_owned();
    let payload = serde_json::json!({
        "ok": true,
        "code": "OK",
        "message": "stub echo",
        "skipped": true,
        "data": { "request": request }
    });
    CString::new(payload.to_string()).unwrap().into_raw()
}
