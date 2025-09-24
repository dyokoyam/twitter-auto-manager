use anyhow::{anyhow, Result};
use rusqlite::{params, Connection, Row};
use serde_json;

use crate::models::ScheduledTweet;

pub fn save_scheduled_tweet_list(
    conn: &Connection,
    account_id: i64,
    scheduled_times: &str,
    content_list: &[String],
    now: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE scheduled_tweets SET is_active = 0, updated_at = ? WHERE account_id = ?",
        params![now, account_id],
    )
    .map_err(|e| anyhow!(e))?;

    if !scheduled_times.is_empty() && !content_list.is_empty() {
        let content_list_json = serde_json::to_string(content_list)?;
        let first_content = content_list.first().cloned().unwrap_or_default();

        conn.execute(
            "INSERT INTO scheduled_tweets (account_id, content, content_list, current_index, scheduled_times, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 0, ?, 1, ?, ?)",
            params![account_id, first_content, content_list_json, scheduled_times, now, now],
        )
        .map_err(|e| anyhow!(e))?;
    }

    Ok(())
}

pub fn save_single_scheduled_tweet(
    conn: &Connection,
    account_id: i64,
    scheduled_times: &str,
    content: &str,
    now: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE scheduled_tweets SET is_active = 0, updated_at = ? WHERE account_id = ?",
        params![now, account_id],
    )
    .map_err(|e| anyhow!(e))?;

    if !scheduled_times.is_empty() && !content.trim().is_empty() {
        conn.execute(
            "INSERT INTO scheduled_tweets (account_id, content, scheduled_times, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 1, ?, ?)",
            params![account_id, content, scheduled_times, now, now],
        )
        .map_err(|e| anyhow!(e))?;
    }

    Ok(())
}

pub fn add_scheduled_tweet(conn: &Connection, tweet: &ScheduledTweet, now: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO scheduled_tweets (account_id, content, content_list, current_index, scheduled_times, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            tweet.account_id,
            tweet.content,
            tweet.content_list,
            tweet.current_index.unwrap_or(0),
            tweet.scheduled_times.clone(),
            tweet.is_active,
            now,
            now
        ],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(conn.last_insert_rowid())
}

pub fn update_post_index(conn: &Connection, account_id: i64, now: &str) -> Result<()> {
    let (current_index, content_list_json): (i32, Option<String>) = conn
        .query_row(
            "SELECT current_index, content_list FROM scheduled_tweets WHERE account_id = ? AND is_active = 1",
            params![account_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| anyhow!("インデックス取得エラー: {}", e))?;

    if let Some(content_list_str) = content_list_json {
        let content_list: Vec<String> = serde_json::from_str(&content_list_str)
            .map_err(|e| anyhow!("JSON解析エラー: {}", e))?;

        if !content_list.is_empty() {
            let next_index = if current_index + 1 >= content_list.len() as i32 {
                0
            } else {
                current_index + 1
            };

            conn.execute(
                "UPDATE scheduled_tweets SET current_index = ?, updated_at = ? WHERE account_id = ? AND is_active = 1",
                params![next_index, now, account_id],
            )
            .map_err(|e| anyhow!("インデックス更新エラー: {}", e))?;

            println!(
                "Updated post index for account {}: {} -> {}",
                account_id, current_index, next_index
            );
        }
    }

    Ok(())
}

pub fn fetch_scheduled_tweets(
    conn: &Connection,
    account_id: Option<i64>,
) -> Result<Vec<ScheduledTweet>> {
    let query = "SELECT id, account_id, content, content_list, current_index, scheduled_times, is_active, created_at, updated_at \
                 FROM scheduled_tweets WHERE ";

    let mut stmt;
    let rows = match account_id {
        Some(id) => {
            stmt = conn
                .prepare(&format!(
                    "{}account_id = ? AND is_active = 1 ORDER BY created_at DESC",
                    query
                ))
                .map_err(|e| anyhow!(e))?;
            stmt.query_map(params![id], row_to_scheduled_tweet)
                .map_err(|e| anyhow!(e))?
        }
        None => {
            stmt = conn
                .prepare(&format!("{}is_active = 1 ORDER BY created_at DESC", query))
                .map_err(|e| anyhow!(e))?;
            stmt.query_map([], row_to_scheduled_tweet)
                .map_err(|e| anyhow!(e))?
        }
    };

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn row_to_scheduled_tweet(row: &Row<'_>) -> rusqlite::Result<ScheduledTweet> {
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
}
