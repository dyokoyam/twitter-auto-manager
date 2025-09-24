#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod db;
mod models;
mod services;
mod state;
mod utils;

use crate::db::init_database;
use crate::state::AppState;

fn main() {
    let db_conn = match init_database() {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            return;
        }
    };

    tauri::Builder::default()
        .manage(AppState::new(db_conn))
        .invoke_handler(tauri::generate_handler![
            commands::dashboard::get_dashboard_stats,
            commands::bots::get_bot_accounts,
            commands::bots::add_bot_account,
            commands::bots::update_bot_account,
            commands::bots::delete_bot_account,
            commands::bots::get_bot_config,
            commands::bots::update_bot_config,
            commands::replies::save_reply_settings,
            commands::replies::get_reply_settings,
            commands::replies::delete_reply_settings,
            commands::replies::update_last_checked_tweet,
            commands::replies::cleanup_orphaned_reply_settings_cmd,
            commands::schedules::save_scheduled_tweet_list,
            commands::schedules::save_scheduled_tweet,
            commands::schedules::update_post_index,
            commands::schedules::add_scheduled_tweet,
            commands::schedules::get_scheduled_tweets,
            commands::logs::get_execution_logs,
            commands::logs::add_execution_log,
            commands::users::get_user_settings,
            commands::users::update_user_settings,
            commands::export::export_data,
            commands::export::export_github_config,
            commands::tests::test_tweet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
