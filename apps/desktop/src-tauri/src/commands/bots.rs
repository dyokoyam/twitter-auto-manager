use chrono::Utc;
use tauri::State;

use crate::db::queries::bots::delete_bot_account as delete_bot_account_in_db;
use crate::db::queries::bots::fetch_all_bots;
use crate::db::queries::bots::get_bot_config as get_bot_config_in_db;
use crate::db::queries::bots::insert_bot_account;
use crate::db::queries::bots::update_bot_account as update_bot_account_in_db;
use crate::db::queries::bots::update_bot_config as update_bot_config_in_db;
use crate::models::{BotAccount, BotConfig};
use crate::state::AppState;

#[tauri::command]
pub fn get_bot_accounts(state: State<AppState>) -> Result<Vec<BotAccount>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    fetch_all_bots(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_bot_account(account: BotAccount, state: State<AppState>) -> Result<i64, String> {
    if account.account_name.trim().is_empty() {
        return Err("Account name is required".to_string());
    }
    if account.api_key.trim().is_empty() {
        return Err("API key is required".to_string());
    }
    if account.api_key_secret.trim().is_empty() {
        return Err("API key secret is required".to_string());
    }
    if account.access_token.trim().is_empty() {
        return Err("Access token is required".to_string());
    }
    if account.access_token_secret.trim().is_empty() {
        return Err("Access token secret is required".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    insert_bot_account(&conn, &account, &now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_bot_account(account: BotAccount, state: State<AppState>) -> Result<(), String> {
    if account.id.is_none() {
        return Err("Account ID is required".to_string());
    }
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    update_bot_account_in_db(&conn, &account, &now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_bot_account(id: i64, state: State<AppState>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    delete_bot_account_in_db(&conn, id, &now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_bot_config(account_id: i64, state: State<AppState>) -> Result<BotConfig, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    get_bot_config_in_db(&conn, account_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_bot_config(config: BotConfig, state: State<AppState>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    update_bot_config_in_db(&conn, &config, &now).map_err(|e| e.to_string())
}
