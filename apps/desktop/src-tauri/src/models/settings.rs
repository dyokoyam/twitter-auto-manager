use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSettings {
    pub id: Option<i64>,
    pub user_id: String,
    pub plan_type: String,
    pub max_accounts: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_accounts: i32,
    pub active_accounts: i32,
    pub today_tweets: i32,
    pub total_tweets: i32,
    pub error_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestTweetRequest {
    pub account_id: i64,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TwitterApiResponse {
    pub success: bool,
    pub tweet_id: Option<String>,
    pub message: String,
}
