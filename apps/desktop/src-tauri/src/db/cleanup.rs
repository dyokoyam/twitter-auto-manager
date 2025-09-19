use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json;

pub fn cleanup_orphaned_reply_settings(conn: &Connection) -> Result<()> {
    let deleted_by_reply_bot = conn.execute(
        "DELETE FROM reply_settings WHERE reply_bot_id NOT IN (SELECT id FROM bot_accounts)",
        [],
    )?;

    let mut orphaned_settings = Vec::new();
    let mut stmt =
        conn.prepare("SELECT id, target_bot_ids FROM reply_settings WHERE is_active = 1")?;
    let rows = stmt.query_map([], |row| {
        let id: i64 = row.get(0)?;
        let target_bot_ids_json: String = row.get(1)?;
        Ok((id, target_bot_ids_json))
    })?;

    for (id, target_bot_ids_json) in rows.flatten() {
        if let Ok(target_bot_ids) = serde_json::from_str::<Vec<i64>>(&target_bot_ids_json) {
            let mut valid_ids = Vec::new();
            for target_id in &target_bot_ids {
                let exists: i32 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM bot_accounts WHERE id = ?",
                        params![target_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(0);

                if exists > 0 {
                    valid_ids.push(*target_id);
                }
            }

            if valid_ids.is_empty() {
                orphaned_settings.push(id);
            } else if valid_ids.len() < target_bot_ids.len() {
                let updated_json = serde_json::to_string(&valid_ids).unwrap();
                let now = Utc::now().to_rfc3339();
                conn.execute(
                    "UPDATE reply_settings SET target_bot_ids = ?, updated_at = ? WHERE id = ?",
                    params![updated_json, now, id],
                )?;
                println!(
                    "Updated reply setting {} with valid target_bot_ids: {:?}",
                    id, valid_ids
                );
            }
        } else {
            orphaned_settings.push(id);
        }
    }

    let orphaned_count = orphaned_settings.len();
    for setting_id in orphaned_settings {
        conn.execute(
            "DELETE FROM reply_settings WHERE id = ?",
            params![setting_id],
        )?;
    }

    if deleted_by_reply_bot > 0 || orphaned_count > 0 {
        println!(
            "Cleaned up orphaned reply settings: {} by reply_bot, {} by target_bots",
            deleted_by_reply_bot, orphaned_count
        );
    }

    Ok(())
}
