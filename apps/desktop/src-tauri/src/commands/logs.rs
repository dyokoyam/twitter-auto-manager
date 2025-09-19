use chrono::Utc;
use tauri::State;

use crate::db::queries::logs::{fetch_execution_logs, insert_execution_log};
use crate::models::ExecutionLog;
use crate::state::AppState;

#[tauri::command]
pub fn get_execution_logs(
    account_id: Option<i64>,
    limit: Option<i32>,
    state: State<AppState>,
) -> Result<Vec<ExecutionLog>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let limit = limit.unwrap_or(100);
    fetch_execution_logs(&conn, account_id, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_execution_log(log: ExecutionLog, state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let now = Utc::now().to_rfc3339();
    insert_execution_log(&conn, &log, &now).map_err(|e| e.to_string())
}
