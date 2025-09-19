use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BotAccount {
    pub id: Option<i64>,
    pub account_name: String,
    pub api_type: String,
    pub api_key: String,
    pub api_key_secret: String,
    pub access_token: String,
    pub access_token_secret: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BotConfig {
    pub id: Option<i64>,
    pub account_id: i64,
    pub is_enabled: bool,
    pub auto_tweet_enabled: bool,
    pub tweet_interval_minutes: i32,
    pub tweet_templates: Option<String>,
    pub hashtags: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduledTweet {
    pub id: Option<i64>,
    pub account_id: i64,
    pub content: String,
    pub content_list: Option<String>,
    pub current_index: Option<i32>,
    pub scheduled_times: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}
