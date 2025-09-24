use std::fs;

use anyhow::{Context, Result};
use chrono::Utc;
use directories::ProjectDirs;
use rusqlite::{params, Connection};

use super::{cleanup::cleanup_orphaned_reply_settings, migrations::run_database_migrations};

pub fn init_database() -> Result<Connection> {
    let proj_dirs = ProjectDirs::from("com", "twilia", "bot-manager")
        .context("Failed to determine project directories")?;

    let data_dir = proj_dirs.data_dir();
    fs::create_dir_all(data_dir).context("Failed to create data directory")?;

    let db_path = data_dir.join("twilia.sqlite");
    let conn = Connection::open(&db_path)?;

    let table_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='bot_accounts'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if table_exists == 0 {
        create_initial_schema(&conn)?;
    } else {
        run_database_migrations(&conn)?;
    }

    cleanup_orphaned_reply_settings(&conn)?;

    Ok(conn)
}

fn create_initial_schema(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS bot_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_name TEXT NOT NULL UNIQUE,
            api_key TEXT NOT NULL,
            api_key_secret TEXT NOT NULL,
            access_token TEXT NOT NULL,
            access_token_secret TEXT NOT NULL,
            api_type TEXT NOT NULL DEFAULT 'Free',
            status TEXT DEFAULT 'inactive',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS bot_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            is_enabled BOOLEAN DEFAULT 0,
            auto_tweet_enabled BOOLEAN DEFAULT 0,
            tweet_interval_minutes INTEGER DEFAULT 60,
            tweet_templates TEXT,
            hashtags TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES bot_accounts(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS reply_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_bot_ids TEXT NOT NULL,
            reply_bot_id INTEGER NOT NULL,
            reply_content TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            last_checked_tweet_ids TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (reply_bot_id) REFERENCES bot_accounts(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS execution_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            log_type TEXT NOT NULL,
            message TEXT NOT NULL,
            tweet_id TEXT,
            tweet_content TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES bot_accounts(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS scheduled_tweets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            content_list TEXT,
            current_index INTEGER DEFAULT 0,
            scheduled_times TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES bot_accounts(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE DEFAULT 'default',
            plan_type TEXT DEFAULT 'starter',
            max_accounts INTEGER DEFAULT 999,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (user_id, created_at, updated_at) VALUES ('default', ?, ?)",
        params![now, now],
    )?;

    Ok(())
}
