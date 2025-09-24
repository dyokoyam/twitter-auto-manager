use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplySettings {
    pub id: Option<i64>,
    pub target_bot_ids: String,
    pub reply_bot_id: i64,
    pub reply_content: String,
    pub is_active: bool,
    pub last_checked_tweet_ids: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
