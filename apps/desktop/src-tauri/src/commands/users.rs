use chrono::Utc;
use tauri::State;

use crate::db::queries::users::{
    fetch_user_settings, update_user_settings as update_user_settings_query,
};
use crate::models::UserSettings;
use crate::state::AppState;

#[tauri::command]
pub fn get_user_settings(state: State<AppState>) -> Result<UserSettings, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    fetch_user_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_user_settings(settings: UserSettings, state: State<AppState>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    update_user_settings_query(&conn, &settings, &now).map_err(|e| e.to_string())
}
