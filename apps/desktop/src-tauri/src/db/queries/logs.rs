use anyhow::{anyhow, Result};
use rusqlite::{params, Connection};

use crate::models::ExecutionLog;

pub fn fetch_execution_logs(
    conn: &Connection,
    account_id: Option<i64>,
    limit: i32,
) -> Result<Vec<ExecutionLog>> {
    let query = match account_id {
        Some(_) => {
            "SELECT * FROM execution_logs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?"
        }
        None => "SELECT * FROM execution_logs ORDER BY created_at DESC LIMIT ?",
    };

    let mut stmt = conn.prepare(query).map_err(|e| anyhow!(e))?;

    let rows = match account_id {
        Some(id) => stmt
            .query_map(params![id, limit], row_to_execution_log)
            .map_err(|e| anyhow!(e))?,
        None => stmt
            .query_map(params![limit], row_to_execution_log)
            .map_err(|e| anyhow!(e))?,
    };

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn insert_execution_log(conn: &Connection, log: &ExecutionLog, timestamp: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO execution_logs (account_id, log_type, message, tweet_id, tweet_content, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            log.account_id,
            log.log_type,
            log.message,
            log.tweet_id,
            log.tweet_content,
            log.status,
            timestamp
        ],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(conn.last_insert_rowid())
}

fn row_to_execution_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExecutionLog> {
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
}
