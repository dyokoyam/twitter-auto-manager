use chrono::Utc;
use tauri::State;

use crate::db::cleanup::cleanup_orphaned_reply_settings;
use crate::db::queries::bots::bot_exists;
use crate::db::queries::replies::{
    count_active_reply_settings, delete_reply_setting,
    fetch_reply_settings as fetch_reply_settings_query,
    save_reply_settings as save_reply_settings_query,
    update_last_checked_tweet as update_last_checked_tweet_query,
};
use crate::models::ReplySettings;
use crate::state::AppState;

#[tauri::command]
pub fn save_reply_settings(
    reply_bot_id: i64,
    target_bot_ids: Vec<i64>,
    reply_content: String,
    state: State<AppState>,
) -> Result<i64, String> {
    if reply_content.trim().is_empty() {
        return Err("返信内容が空です".to_string());
    }
    if target_bot_ids.is_empty() {
        return Err("監視対象Botが選択されていません".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;

    if !bot_exists(&conn, reply_bot_id).map_err(|e| e.to_string())? {
        return Err(format!("返信Bot ID {} が存在しません", reply_bot_id));
    }

    for target_id in &target_bot_ids {
        if !bot_exists(&conn, *target_id).map_err(|e| e.to_string())? {
            return Err(format!("監視対象Bot ID {} が存在しません", target_id));
        }
    }

    save_reply_settings_query(&conn, reply_bot_id, &target_bot_ids, &reply_content, &now)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_reply_settings(state: State<AppState>) -> Result<Vec<ReplySettings>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    fetch_reply_settings_query(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_reply_settings(id: i64, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    delete_reply_setting(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_last_checked_tweet(
    target_bot_id: i64,
    tweet_id: String,
    reply_bot_id: i64,
    state: State<AppState>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    update_last_checked_tweet_query(&conn, reply_bot_id, target_bot_id, &tweet_id, &now)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cleanup_orphaned_reply_settings_cmd(state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    let initial = count_active_reply_settings(&conn).map_err(|e| e.to_string())?;
    cleanup_orphaned_reply_settings(&conn).map_err(|e| e.to_string())?;
    let final_count = count_active_reply_settings(&conn).map_err(|e| e.to_string())?;
    Ok(initial - final_count)
}
