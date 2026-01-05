use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use std::sync::{atomic::AtomicBool, Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

use hidapi::HidDevice;

pub struct Device {
    device: Arc<Mutex<HidDevice>>,
    exit_signal: Arc<AtomicBool>,
}

pub struct HidState {
    api: Arc<Mutex<hidapi::HidApi>>,
    device: Arc<Mutex<Option<Device>>>,
}

impl Drop for Device {
    fn drop(&mut self) {
        self.exit_signal
            .store(true, std::sync::atomic::Ordering::SeqCst);
    }
}

pub fn init_state() -> HidState {
    HidState {
        api: Arc::new(Mutex::new(hidapi::HidApi::new().unwrap())),
        device: Arc::new(Mutex::new(None)),
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub path: String,
    pub product_string: Option<String>,
}

#[tauri::command]
pub async fn hid_list_devices(
    state: State<'_, HidState>,
    filter_zero_vid_pid: Option<bool>,
) -> Result<Vec<DeviceInfo>, String> {
    let mut api = state.api.lock().unwrap();
    api.refresh_devices().map_err(|e| e.to_string())?;
    let devices = api
        .device_list()
        .filter(|device| {
            // Filter out keyboards and mice (Usage Page 0x01, Usage 0x01-0x02)
            let usage_page = device.usage_page();
            let usage = device.usage();
            if usage_page == 0x01 && (usage == 0x01 || usage == 0x02) {
                return false;
            }
            if filter_zero_vid_pid == Some(true) {
                device.vendor_id() != 0 && device.product_id() != 0
            } else {
                true
            }
        })
        .map(|device| DeviceInfo {
            vendor_id: device.vendor_id(),
            product_id: device.product_id(),
            path: device.path().to_str().unwrap_or("").to_string(),
            product_string: device.product_string().map(|s| s.to_string()),
        })
        .collect();
    Ok(devices)
}

#[tauri::command]
pub async fn hid_open(
    app: AppHandle,
    state: State<'_, HidState>,
    path: String,
    frame_size: usize,
) -> Result<(), String> {
    // close existing device
    {
        let mut device_guard = state.device.lock().unwrap();
        *device_guard = None;
    }
    // open device
    let api = state.api.lock().unwrap();
    let device = api
        .open_path(
            std::ffi::CStr::from_bytes_with_nul(format!("{}\0", path).as_bytes())
                .map_err(|_| "Invalid path")?,
        )
        .map_err(|e| e.to_string())?;
    drop(api);

    // create device state
    let device_arc = Arc::new(Mutex::new(device));
    let exit_signal = Arc::new(AtomicBool::new(false));

    // clone for thread
    let device_clone = Arc::clone(&device_arc);
    let exit_clone = Arc::clone(&exit_signal);

    // start read thread
    tauri::async_runtime::spawn(async move {
        let mut read_buf = vec![0u8; frame_size];

        while !exit_clone.load(Ordering::Relaxed) {
            let res = {
                // only lock when reading
                let device = device_clone.lock().unwrap();
                device.read_timeout(&mut read_buf, 5)
            };

            match res {
                Ok(n) if n > 0 => {
                    let data = read_buf[..n].to_vec();
                    let _ = app.emit("response", data);
                }
                Ok(_) => {
                    std::thread::yield_now();
                }
                Err(_) => {
                    break;
                }
            }
        }
    });

    let mut device_guard = state.device.lock().unwrap();
    *device_guard = Some(Device {
        device: device_arc,
        exit_signal,
    });

    Ok(())
}

#[tauri::command]
pub async fn hid_close(state: State<'_, HidState>) -> Result<(), String> {
    let mut device = state.device.lock().unwrap();
    if let Some(device) = device.take() {
        device.exit_signal.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn hid_write(state: State<'_, HidState>, data: Vec<u8>) -> Result<(), String> {
    let device = state.device.lock().unwrap();
    if let Some(device) = device.as_ref() {
        let device = device.device.lock().unwrap();
        device.write(&data).map_err(|e| e.to_string())?;
    }
    Ok(())
}
