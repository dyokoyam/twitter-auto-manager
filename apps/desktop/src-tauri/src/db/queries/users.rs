use anyhow::{anyhow, Result};
use rusqlite::{params, Connection};

use crate::models::UserSettings;

pub fn fetch_user_settings(conn: &Connection) -> Result<UserSettings> {
    conn.query_row(
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
    .map_err(|e| anyhow!(e))
}

pub fn update_user_settings(conn: &Connection, settings: &UserSettings, now: &str) -> Result<()> {
    conn.execute(
        "UPDATE user_settings SET plan_type = ?, max_accounts = ?, updated_at = ? WHERE user_id = 'default'",
        params![settings.plan_type, settings.max_accounts, now],
    )
    .map_err(|e| anyhow!(e))?;

    Ok(())
}
