use std::collections::HashMap;

use anyhow::{anyhow, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json;

use super::bots::bot_exists;
use crate::models::ReplySettings;

pub fn save_reply_settings(
    conn: &Connection,
    reply_bot_id: i64,
    target_bot_ids: &[i64],
    reply_content: &str,
    now: &str,
) -> Result<i64> {
    let target_bot_ids_json = serde_json::to_string(target_bot_ids)?;

    conn.execute(
        "UPDATE reply_settings SET is_active = 0, updated_at = ? WHERE reply_bot_id = ?",
        params![now, reply_bot_id],
    )
    .map_err(|e| anyhow!(e))?;

    conn.execute(
        "INSERT INTO reply_settings (target_bot_ids, reply_bot_id, reply_content, is_active, last_checked_tweet_ids, created_at, updated_at)
         VALUES (?, ?, ?, 1, '[]', ?, ?)",
        params![target_bot_ids_json, reply_bot_id, reply_content, now, now],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(conn.last_insert_rowid())
}

pub fn fetch_reply_settings(conn: &Connection) -> Result<Vec<ReplySettings>> {
    let mut stmt = conn
        .prepare(
            "SELECT rs.* FROM reply_settings rs
         INNER JOIN bot_accounts ba ON rs.reply_bot_id = ba.id
         WHERE rs.is_active = 1 
         ORDER BY rs.created_at DESC",
        )
        .map_err(|e| anyhow!(e))?;

    let settings_iter = stmt
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
        .map_err(|e| anyhow!(e))?;

    let mut valid_settings = Vec::new();
    let now = Utc::now().to_rfc3339();

    for mut setting in settings_iter.collect::<Result<Vec<_>, _>>()? {
        if let Ok(target_ids) = serde_json::from_str::<Vec<i64>>(&setting.target_bot_ids) {
            let original_len = target_ids.len();
            let mut valid_targets = Vec::new();

            for target_id in target_ids {
                if bot_exists(conn, target_id)? {
                    valid_targets.push(target_id);
                }
            }

            if !valid_targets.is_empty() {
                if valid_targets.len() != original_len {
                    setting.target_bot_ids = serde_json::to_string(&valid_targets)?;
                    conn.execute(
                        "UPDATE reply_settings SET target_bot_ids = ?, updated_at = ? WHERE id = ?",
                        params![setting.target_bot_ids, now, setting.id],
                    )
                    .map_err(|e| anyhow!(e))?;
                    setting.updated_at = now.clone();
                }

                valid_settings.push(setting);
            }
        }
    }

    Ok(valid_settings)
}

pub fn delete_reply_setting(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM reply_settings WHERE id = ?", params![id])
        .map_err(|e| anyhow!(e))?;
    Ok(())
}

pub fn update_last_checked_tweet(
    conn: &Connection,
    reply_bot_id: i64,
    target_bot_id: i64,
    tweet_id: &str,
    now: &str,
) -> Result<()> {
    let current_ids: String = conn
        .query_row(
            "SELECT last_checked_tweet_ids FROM reply_settings WHERE reply_bot_id = ? AND is_active = 1",
            params![reply_bot_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "[]".to_string());

    let mut tweet_id_map: HashMap<String, String> =
        if let Ok(ids) = serde_json::from_str::<Vec<String>>(&current_ids) {
            ids.into_iter()
                .filter_map(|entry| {
                    let parts: Vec<&str> = entry.split(':').collect();
                    if parts.len() == 2 {
                        Some((parts[0].to_string(), parts[1].to_string()))
                    } else {
                        None
                    }
                })
                .collect()
        } else {
            HashMap::new()
        };

    tweet_id_map.insert(target_bot_id.to_string(), tweet_id.to_string());

    let updated_ids: Vec<String> = tweet_id_map
        .into_iter()
        .map(|(bot_id, tweet)| format!("{}:{}", bot_id, tweet))
        .collect();

    let updated_ids_json = serde_json::to_string(&updated_ids)?;

    conn.execute(
        "UPDATE reply_settings SET last_checked_tweet_ids = ?, updated_at = ? 
         WHERE reply_bot_id = ? AND is_active = 1",
        params![updated_ids_json, now, reply_bot_id],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(())
}

pub fn count_active_reply_settings(conn: &Connection) -> Result<i32> {
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM reply_settings WHERE is_active = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| anyhow!(e))?;
    Ok(count)
}
