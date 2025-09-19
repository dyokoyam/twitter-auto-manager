use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json;

pub fn run_database_migrations(conn: &Connection) -> Result<()> {
    let reply_table_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='reply_settings'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if reply_table_exists == 0 {
        conn.execute(
            "CREATE TABLE reply_settings (
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
        println!("Created reply_settings table with new schema (multiple targets, single replier)");
    } else {
        migrate_reply_settings_table(conn)?;
    }

    let table_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='scheduled_tweets'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if table_exists == 0 {
        conn.execute(
            "CREATE TABLE scheduled_tweets (
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
        println!("Created scheduled_tweets table with content_list support");
    } else {
        ensure_scheduled_tweets_columns(conn)?;
    }

    Ok(())
}

fn ensure_scheduled_tweets_columns(conn: &Connection) -> Result<()> {
    let content_list_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('scheduled_tweets') WHERE name='content_list'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if content_list_exists == 0 {
        conn.execute(
            "ALTER TABLE scheduled_tweets ADD COLUMN content_list TEXT",
            [],
        )?;
        println!("Added content_list column to scheduled_tweets table");
    }

    let current_index_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('scheduled_tweets') WHERE name='current_index'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_index_exists == 0 {
        conn.execute(
            "ALTER TABLE scheduled_tweets ADD COLUMN current_index INTEGER DEFAULT 0",
            [],
        )?;
        println!("Added current_index column to scheduled_tweets table");
    }

    let scheduled_times_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('scheduled_tweets') WHERE name='scheduled_times'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if scheduled_times_exists == 0 {
        conn.execute(
            "ALTER TABLE scheduled_tweets ADD COLUMN scheduled_times TEXT DEFAULT ''",
            [],
        )?;
        println!("Added scheduled_times column to scheduled_tweets table");
    }

    let is_active_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('scheduled_tweets') WHERE name='is_active'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if is_active_exists == 0 {
        conn.execute(
            "ALTER TABLE scheduled_tweets ADD COLUMN is_active BOOLEAN DEFAULT 1",
            [],
        )?;
        println!("Added is_active column to scheduled_tweets table");
    }

    Ok(())
}

fn migrate_reply_settings_table(conn: &Connection) -> Result<()> {
    let target_bot_ids_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('reply_settings') WHERE name='target_bot_ids'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if target_bot_ids_exists == 0 {
        println!("Migrating reply_settings table to new schema...");

        let mut existing_settings = Vec::new();
        {
            let mut stmt = conn.prepare("SELECT * FROM reply_settings WHERE is_active = 1")?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            })?;

            existing_settings.extend(rows.flatten());
        }

        conn.execute("DROP TABLE reply_settings", [])?;

        conn.execute(
            "CREATE TABLE reply_settings (
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

        let now = Utc::now().to_rfc3339();
        for (target_bot_id, reply_bot_ids, reply_content, created_at, last_checked_tweet_id) in
            existing_settings
        {
            if let Ok(reply_bot_id_list) = serde_json::from_str::<Vec<i64>>(&reply_bot_ids) {
                for reply_bot_id in reply_bot_id_list {
                    let last_checked_tweet_ids = if let Some(tweet_id) = &last_checked_tweet_id {
                        serde_json::to_string(&vec![format!("{}:{}", target_bot_id, tweet_id)])
                            .unwrap_or_else(|_| "[]".to_string())
                    } else {
                        "[]".to_string()
                    };

                    conn.execute(
                        "INSERT INTO reply_settings (target_bot_ids, reply_bot_id, reply_content, is_active, last_checked_tweet_ids, created_at, updated_at)
                         VALUES (?, ?, ?, 1, ?, ?, ?)",
                        params![
                            serde_json::to_string(&vec![target_bot_id]).unwrap(),
                            reply_bot_id,
                            reply_content,
                            last_checked_tweet_ids,
                            created_at,
                            now
                        ],
                    )?;
                }
            }
        }

        println!("Successfully migrated reply_settings table to new schema");
    }

    Ok(())
}
