use tauri::State;

use crate::db::queries::bots::fetch_dashboard_stats;
use crate::models::DashboardStats;
use crate::state::AppState;

#[tauri::command]
pub fn get_dashboard_stats(state: State<AppState>) -> Result<DashboardStats, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    fetch_dashboard_stats(&conn).map_err(|e| e.to_string())
}
