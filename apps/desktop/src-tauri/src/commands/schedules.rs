use chrono::Utc;
use tauri::State;

use crate::db::queries::schedules::{
    add_scheduled_tweet as add_scheduled_tweet_query, fetch_scheduled_tweets,
    save_scheduled_tweet_list as save_scheduled_tweet_list_query, save_single_scheduled_tweet,
    update_post_index as update_post_index_query,
};
use crate::models::ScheduledTweet;
use crate::state::AppState;

#[tauri::command]
pub fn save_scheduled_tweet_list(
    account_id: i64,
    scheduled_times: String,
    content_list: Vec<String>,
    state: State<AppState>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    save_scheduled_tweet_list_query(&conn, account_id, &scheduled_times, &content_list, &now)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_scheduled_tweet(
    account_id: i64,
    scheduled_times: String,
    content: String,
    state: State<AppState>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    save_single_scheduled_tweet(&conn, account_id, &scheduled_times, &content, &now)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_post_index(account_id: i64, state: State<AppState>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    update_post_index_query(&conn, account_id, &now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_scheduled_tweet(tweet: ScheduledTweet, state: State<AppState>) -> Result<i64, String> {
    let now = Utc::now().to_rfc3339();
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    add_scheduled_tweet_query(&conn, &tweet, &now).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_scheduled_tweets(
    account_id: Option<i64>,
    state: State<AppState>,
) -> Result<Vec<ScheduledTweet>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
    fetch_scheduled_tweets(&conn, account_id).map_err(|e| e.to_string())
}
