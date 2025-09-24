use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{Connection, Result as SqliteResult};
use serde_json::Value;

use crate::models::{BotAccount, ExecutionLog, ReplySettings, ScheduledTweet, UserSettings};

fn project_root() -> PathBuf {
    if let Ok(custom) = std::env::var("TAM_EXPORT_ROOT") {
        let candidate = PathBuf::from(custom);
        if candidate.exists() {
            return candidate;
        }
    }

    let start = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut current = start.clone();

    let is_root = |dir: &Path| {
        dir.join("config").join("actions").exists() && dir.join("package.json").exists()
    };

    if is_root(&current) {
        return current;
    }

    for _ in 0..8 {
        if !current.pop() {
            break;
        }
        if is_root(&current) {
            return current;
        }
    }

    start
}

fn normalize_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return project_root().to_string_lossy().to_string();
    }

    let relative = trimmed.strip_prefix("./").unwrap_or(trimmed);
    let candidate = Path::new(relative);

    if candidate.is_absolute() {
        return candidate.to_path_buf().to_string_lossy().to_string();
    }

    project_root().join(candidate).to_string_lossy().to_string()
}

fn ensure_parent_directory(path: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create parent directory for {}: {}",
                parent.display(),
                e
            )
        })?;
    }
    Ok(())
}

pub fn export_data(conn: &Connection, raw_path: &str) -> Result<(), String> {
    let adjusted_path = normalize_path(raw_path);
    ensure_parent_directory(&adjusted_path)?;

    let mut stmt = conn
        .prepare("SELECT * FROM bot_accounts ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let accounts_rows = stmt
        .query_map([], |row| {
            Ok(BotAccount {
                id: row.get(0)?,
                account_name: row.get(1)?,
                api_key: row.get(2)?,
                api_key_secret: row.get(3)?,
                access_token: row.get(4)?,
                access_token_secret: row.get(5)?,
                api_type: row.get(6)?,
                status: row.get(7)?,
                created_at: Some(row.get(8)?),
                updated_at: Some(row.get(9)?),
            })
        })
        .map_err(|e| e.to_string())?;

    let accounts: Vec<BotAccount> = accounts_rows
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    let mut scheduled_stmt = conn
        .prepare("SELECT id, account_id, content, content_list, current_index, scheduled_times, is_active, created_at, updated_at FROM scheduled_tweets WHERE is_active = 1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let scheduled_rows = scheduled_stmt
        .query_map([], |row| {
            Ok(ScheduledTweet {
                id: row.get(0)?,
                account_id: row.get(1)?,
                content: row.get(2)?,
                content_list: row.get(3)?,
                current_index: row.get(4)?,
                scheduled_times: row.get(5)?,
                is_active: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let scheduled_tweets: Vec<ScheduledTweet> = scheduled_rows
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    let mut reply_stmt = conn
        .prepare("SELECT * FROM reply_settings WHERE is_active = 1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let reply_rows = reply_stmt
        .query_map([], |row| {
            Ok(ReplySettings {
                id: row.get(0)?,
                target_bot_ids: row.get(1)?,
                reply_bot_id: row.get(2)?,
                reply_content: row.get(3)?,
                is_active: row.get(4)?,
                last_checked_tweet_ids: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let reply_settings: Vec<ReplySettings> = reply_rows
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    let mut logs_stmt = conn
        .prepare("SELECT * FROM execution_logs ORDER BY created_at DESC LIMIT 1000")
        .map_err(|e| e.to_string())?;

    let logs_rows = logs_stmt
        .query_map([], |row| {
            Ok(ExecutionLog {
                id: row.get(0)?,
                account_id: row.get(1)?,
                log_type: row.get(2)?,
                message: row.get(3)?,
                tweet_id: row.get(4)?,
                tweet_content: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let logs: Vec<ExecutionLog> = logs_rows
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    let user_settings = conn
        .query_row(
            "SELECT * FROM user_settings WHERE user_id = 'default'",
            [],
            |row| {
                Ok(UserSettings {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    plan_type: row.get(2)?,
                    max_accounts: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    let export_payload = serde_json::json!({
        "exported_at": Utc::now().to_rfc3339(),
        "accounts": accounts,
        "scheduled_tweets": scheduled_tweets,
        "reply_settings": reply_settings,
        "logs": logs,
        "user_settings": user_settings,
    });

    fs::write(
        &adjusted_path,
        serde_json::to_string_pretty(&export_payload)
            .map_err(|e| format!("Failed to serialize JSON: {}", e))?,
    )
    .map_err(|e| format!("Failed to write file ({}): {}", adjusted_path, e))?;

    println!("Data export completed: {}", adjusted_path);
    Ok(())
}

pub fn export_github_config(conn: &Connection, raw_path: &str) -> Result<(), String> {
    let adjusted_path = normalize_path(raw_path);
    ensure_parent_directory(&adjusted_path)?;

    let mut stmt = conn
        .prepare(
            "SELECT ba.*, st.content, st.content_list, st.current_index, st.scheduled_times 
         FROM bot_accounts ba 
         LEFT JOIN scheduled_tweets st ON ba.id = st.account_id AND st.is_active = 1
         WHERE ba.status = 'active'
         ORDER BY ba.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let account = BotAccount {
                id: row.get(0)?,
                account_name: row.get(1)?,
                api_key: row.get(2)?,
                api_key_secret: row.get(3)?,
                access_token: row.get(4)?,
                access_token_secret: row.get(5)?,
                api_type: row.get(6)?,
                status: row.get(7)?,
                created_at: Some(row.get(8)?),
                updated_at: Some(row.get(9)?),
            };

            let scheduled_content: Option<String> = row.get(10).ok();
            let content_list_json: Option<String> = row.get(11).ok();
            let current_index: Option<i32> = row.get(12).ok();
            let scheduled_times: Option<String> = row.get(13).ok();

            let bot_data = if let Some(content_list_str) = content_list_json {
                serde_json::json!({
                    "account": account,
                    "scheduled_content_list": content_list_str,
                    "current_index": current_index.unwrap_or(0),
                    "scheduled_times": scheduled_times
                })
            } else {
                serde_json::json!({
                    "account": account,
                    "scheduled_content": scheduled_content,
                    "scheduled_times": scheduled_times
                })
            };

            Ok(bot_data)
        })
        .map_err(|e| e.to_string())?;

    let bot_configs: Vec<Value> = rows
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    let mut reply_stmt = conn
        .prepare(
            "SELECT rs.* FROM reply_settings rs
         INNER JOIN bot_accounts ba ON rs.reply_bot_id = ba.id
         WHERE rs.is_active = 1",
        )
        .map_err(|e| e.to_string())?;

    let reply_rows = reply_stmt
        .query_map([], |row| {
            Ok(ReplySettings {
                id: row.get(0)?,
                target_bot_ids: row.get(1)?,
                reply_bot_id: row.get(2)?,
                reply_content: row.get(3)?,
                is_active: row.get(4)?,
                last_checked_tweet_ids: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let reply_settings: Vec<ReplySettings> = reply_rows
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    let github_config = serde_json::json!({
        "version": "1.0",
        "bots": bot_configs,
        "reply_settings": reply_settings,
        "updated_at": Utc::now().to_rfc3339()
    });

    fs::write(
        &adjusted_path,
        serde_json::to_string_pretty(&github_config)
            .map_err(|e| format!("Failed to serialize JSON: {}", e))?,
    )
    .map_err(|e| format!("Failed to write file ({}): {}", adjusted_path, e))?;

    println!("GitHub Actions config exported: {}", adjusted_path);

    Ok(())
}
