use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionLog {
    pub id: Option<i64>,
    pub account_id: i64,
    pub log_type: String,
    pub message: String,
    pub tweet_id: Option<String>,
    pub tweet_content: Option<String>,
    pub status: String,
    pub created_at: String,
}
