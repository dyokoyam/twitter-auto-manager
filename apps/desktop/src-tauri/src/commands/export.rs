use tauri::State;

use crate::services::{
    export_data as export_data_service, export_github_config as export_github_config_service,
};
use crate::state::AppState;

#[tauri::command]
pub fn export_data(path: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    export_data_service(&conn, &path)
}

#[tauri::command]
pub fn export_github_config(path: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    export_github_config_service(&conn, &path)
}
