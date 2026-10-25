#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod razer;

use razer::{DeviceState, DeviceView, Lighting, Manager};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager as _, State};
use tauri_plugin_dialog::DialogExt;

struct Devices(Mutex<Manager>);

fn with<T>(state: &State<Devices>, f: impl FnOnce(&mut Manager) -> Result<T, String>) -> Result<T, String> {
    let mut m = state.0.lock().map_err(|_| "device manager poisoned".to_string())?;
    f(&mut m)
}

// ------------------------------------------------------------------ devices

#[tauri::command]
fn list_devices(state: State<Devices>) -> Result<Vec<DeviceView>, String> {
    with(&state, |m| m.refresh())
}

#[tauri::command]
fn device_state(state: State<Devices>, key: String) -> Result<DeviceState, String> {
    with(&state, |m| m.state(&key))
}

#[tauri::command]
fn set_dpi(state: State<Devices>, key: String, x: u16, y: u16) -> Result<(), String> {
    with(&state, |m| m.set_dpi(&key, x, y))
}

#[tauri::command]
fn set_dpi_stages(state: State<Devices>, key: String, active: u8, stages: Vec<(u16, u16)>) -> Result<(), String> {
    with(&state, |m| m.set_stages(&key, active, &stages))
}

#[tauri::command]
fn set_polling(state: State<Devices>, key: String, hz: u32) -> Result<(), String> {
    with(&state, |m| m.set_polling(&key, hz))
}

#[tauri::command]
fn set_lighting(state: State<Devices>, key: String, zone: u8, lighting: Lighting, brightness: u8) -> Result<(), String> {
    with(&state, |m| m.set_lighting(&key, zone, &lighting, brightness))
}

#[tauri::command]
fn set_liftoff(state: State<Devices>, key: String, level: u8) -> Result<(), String> {
    with(&state, |m| m.set_liftoff(&key, level))
}

#[tauri::command]
fn set_dongle_led(state: State<Devices>, key: String, mode: u8) -> Result<(), String> {
    with(&state, |m| m.set_dongle_led(&key, mode))
}

#[tauri::command]
fn set_dynamic_sensitivity(state: State<Devices>, key: String, on: bool, curve: u8, custom_max: f32) -> Result<(), String> {
    with(&state, |m| m.set_dynamic_sensitivity(&key, on, curve, custom_max))
}

#[tauri::command]
fn set_button(state: State<Devices>, key: String, button: u8, function: u8) -> Result<(), String> {
    with(&state, |m| m.set_button(&key, button, function))
}

#[tauri::command]
fn set_power(state: State<Devices>, key: String, idle: Option<u16>, low_battery: Option<u8>) -> Result<(), String> {
    with(&state, |m| m.set_power(&key, idle, low_battery))
}

// ------------------------------------------------------------------ storage

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("library.json"))
}

#[tauri::command]
fn load_library(app: AppHandle) -> Result<String, String> {
    match fs::read_to_string(store_path(&app)?) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn save_library(app: AppHandle, json: String) -> Result<(), String> {
    let path = store_path(&app)?;
    // write atomically so a crash never corrupts the library
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_file(app: AppHandle, name: String, contents: String) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter("Open Synapse preset", &["osp"])
        .blocking_save_file();
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else { return Ok(None) };
    fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(Some(path.display().to_string()))
}

#[tauri::command]
async fn import_files(app: AppHandle) -> Result<Vec<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Open Synapse preset", &["osp", "json"])
        .blocking_pick_files()
        .unwrap_or_default();
    picked
        .into_iter()
        .filter_map(|p| p.into_path().ok())
        .map(|p| fs::read_to_string(p).map_err(|e| e.to_string()))
        .collect()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Devices(Mutex::new(Manager::new())))
        .invoke_handler(tauri::generate_handler![
            list_devices,
            device_state,
            set_dpi,
            set_dpi_stages,
            set_polling,
            set_lighting,
            set_power,
            set_liftoff,
            set_dongle_led,
            set_dynamic_sensitivity,
            set_button,
            load_library,
            save_library,
            export_file,
            import_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Synapse");
}
