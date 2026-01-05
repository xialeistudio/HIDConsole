mod hid;

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "HIDConsole",
        "version": env!("CARGO_PKG_VERSION"),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            hid::hid_list_devices,
            hid::hid_open,
            hid::hid_close,
            hid::hid_write
        ])
        .manage(hid::init_state())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
