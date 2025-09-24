use anyhow::{anyhow, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json;

use crate::db::cleanup::cleanup_orphaned_reply_settings;
use crate::models::{BotAccount, BotConfig, DashboardStats};

pub fn fetch_all_bots(conn: &Connection) -> Result<Vec<BotAccount>> {
    let mut stmt = conn
        .prepare("SELECT * FROM bot_accounts ORDER BY created_at DESC")
        .map_err(|e| anyhow!(e))?;

    let rows = stmt
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
        .map_err(|e| anyhow!(e))?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn insert_bot_account(conn: &Connection, account: &BotAccount, now: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO bot_accounts (account_name, api_key, api_key_secret, access_token, access_token_secret, api_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            account.account_name,
            account.api_key,
            account.api_key_secret,
            account.access_token,
            account.access_token_secret,
            account.api_type,
            account.status,
            now,
            now
        ],
    )
    .map_err(|e| anyhow!(e))?;

    let account_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO bot_configs (account_id, created_at, updated_at)
         VALUES (?, ?, ?)",
        params![account_id, now, now],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(account_id)
}

pub fn update_bot_account(conn: &Connection, account: &BotAccount, now: &str) -> Result<()> {
    let id = account
        .id
        .ok_or_else(|| anyhow!("account id is required for update"))?;

    conn.execute(
        "UPDATE bot_accounts
         SET account_name = ?, api_key = ?, api_key_secret = ?, access_token = ?, access_token_secret = ?,
             api_type = ?, status = ?, updated_at = ?
         WHERE id = ?",
        params![
            account.account_name,
            account.api_key,
            account.api_key_secret,
            account.access_token,
            account.access_token_secret,
            account.api_type,
            account.status,
            now,
            id
        ],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(())
}

pub fn delete_bot_account(conn: &Connection, id: i64, now: &str) -> Result<()> {
    let deleted_reply_settings = conn
        .execute(
            "DELETE FROM reply_settings WHERE reply_bot_id = ?",
            params![id],
        )
        .map_err(|e| anyhow!(e))?;

    let mut settings_to_update = Vec::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, target_bot_ids FROM reply_settings WHERE is_active = 1")
            .map_err(|e| anyhow!(e))?;
        let rows = stmt
            .query_map([], |row| {
                let setting_id: i64 = row.get(0)?;
                let target_bot_ids_json: String = row.get(1)?;
                Ok((setting_id, target_bot_ids_json))
            })
            .map_err(|e| anyhow!(e))?;

        for (setting_id, target_bot_ids_json) in rows.collect::<Result<Vec<_>, _>>()? {
            if let Ok(target_bot_ids) = serde_json::from_str::<Vec<i64>>(&target_bot_ids_json) {
                let original_len = target_bot_ids.len();
                let updated_target_bot_ids: Vec<i64> = target_bot_ids
                    .into_iter()
                    .filter(|&target_id| target_id != id)
                    .collect();

                if updated_target_bot_ids.len() != original_len {
                    if updated_target_bot_ids.is_empty() {
                        settings_to_update.push((setting_id, None));
                    } else {
                        let updated_json = serde_json::to_string(&updated_target_bot_ids)?;
                        settings_to_update.push((setting_id, Some(updated_json)));
                    }
                }
            }
        }
    }

    for (setting_id, updated_targets) in settings_to_update {
        match updated_targets {
            Some(json) => {
                conn.execute(
                    "UPDATE reply_settings SET target_bot_ids = ?, updated_at = ? WHERE id = ?",
                    params![json, now, setting_id],
                )
                .map_err(|e| anyhow!(e))?;
            }
            None => {
                conn.execute(
                    "DELETE FROM reply_settings WHERE id = ?",
                    params![setting_id],
                )
                .map_err(|e| anyhow!(e))?;
            }
        }
    }

    conn.execute("DELETE FROM bot_accounts WHERE id = ?", params![id])
        .map_err(|e| anyhow!(e))?;

    cleanup_orphaned_reply_settings(conn)?;

    println!(
        "Deleted bot account {} and cleaned up {} reply settings",
        id, deleted_reply_settings
    );

    Ok(())
}

pub fn get_bot_config(conn: &Connection, account_id: i64) -> Result<BotConfig> {
    conn.query_row(
        "SELECT * FROM bot_configs WHERE account_id = ?",
        params![account_id],
        |row| {
            Ok(BotConfig {
                id: row.get(0)?,
                account_id: row.get(1)?,
                is_enabled: row.get(2)?,
                auto_tweet_enabled: row.get(3)?,
                tweet_interval_minutes: row.get(4)?,
                tweet_templates: row.get(5)?,
                hashtags: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| anyhow!(e))
}

pub fn update_bot_config(conn: &Connection, config: &BotConfig, now: &str) -> Result<()> {
    conn.execute(
        "UPDATE bot_configs 
         SET is_enabled = ?, auto_tweet_enabled = ?, tweet_interval_minutes = ?,
             tweet_templates = ?, hashtags = ?, updated_at = ?
         WHERE account_id = ?",
        params![
            config.is_enabled,
            config.auto_tweet_enabled,
            config.tweet_interval_minutes,
            config.tweet_templates,
            config.hashtags,
            now,
            config.account_id
        ],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(())
}

pub fn find_bot_account_by_id(conn: &Connection, id: i64) -> Result<BotAccount> {
    conn.query_row(
        "SELECT * FROM bot_accounts WHERE id = ?",
        params![id],
        |row| {
            Ok(BotAccount {
                id: Some(row.get(0)?),
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
        },
    )
    .map_err(|e| anyhow!(e))
}

pub fn bot_exists(conn: &Connection, id: i64) -> Result<bool> {
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM bot_accounts WHERE id = ?",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| anyhow!(e))?;
    Ok(count > 0)
}

pub fn fetch_dashboard_stats(conn: &Connection) -> Result<DashboardStats> {
    let total_accounts: i32 = conn
        .query_row("SELECT COUNT(*) FROM bot_accounts", [], |row| row.get(0))
        .map_err(|e| anyhow!(e))?;

    let active_accounts: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM bot_accounts WHERE status = 'active'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| anyhow!(e))?;

    let today = Utc::now().format("%Y-%m-%d").to_string();

    let today_tweets: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM execution_logs WHERE log_type = 'tweet' AND date(created_at) = ?",
            params![today],
            |row| row.get(0),
        )
        .map_err(|e| anyhow!(e))?;

    let total_tweets: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM execution_logs WHERE log_type = 'tweet'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| anyhow!(e))?;

    let error_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM execution_logs WHERE status = 'error' AND date(created_at) = ?",
            params![today],
            |row| row.get(0),
        )
        .map_err(|e| anyhow!(e))?;

    Ok(DashboardStats {
        total_accounts,
        active_accounts,
        today_tweets,
        total_tweets,
        error_count,
    })
}
