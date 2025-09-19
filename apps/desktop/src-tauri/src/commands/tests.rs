use chrono::Utc;
use tauri::State;

use crate::db::queries::bots::find_bot_account_by_id;
use crate::db::queries::logs::insert_execution_log;
use crate::models::{ExecutionLog, TestTweetRequest, TwitterApiResponse};
use crate::services::post_to_twitter;
use crate::state::AppState;

#[tauri::command]
pub async fn test_tweet(
    request: TestTweetRequest,
    state: State<'_, AppState>,
) -> Result<TwitterApiResponse, String> {
    let account = {
        let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
        find_bot_account_by_id(&conn, request.account_id).map_err(|e| e.to_string())?
    };

    match post_to_twitter(&account, &request.content).await {
        Ok(tweet_id) => {
            let log = ExecutionLog {
                id: None,
                account_id: request.account_id,
                log_type: "tweet".to_string(),
                message: "ツイート投稿が成功しました".to_string(),
                tweet_id: Some(tweet_id.clone()),
                tweet_content: Some(request.content.clone()),
                status: "success".to_string(),
                created_at: Utc::now().to_rfc3339(),
            };

            {
                let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
                insert_execution_log(&conn, &log, &log.created_at).map_err(|e| e.to_string())?;
            }

            Ok(TwitterApiResponse {
                success: true,
                tweet_id: Some(tweet_id),
                message: "ツイート投稿が成功しました".to_string(),
            })
        }
        Err(error) => {
            let log = ExecutionLog {
                id: None,
                account_id: request.account_id,
                log_type: "error".to_string(),
                message: format!("ツイート投稿に失敗しました: {}", error),
                tweet_id: None,
                tweet_content: Some(request.content.clone()),
                status: "error".to_string(),
                created_at: Utc::now().to_rfc3339(),
            };

            {
                let conn = state.db.lock().map_err(|_| "Failed to lock database")?;
                insert_execution_log(&conn, &log, &log.created_at).map_err(|e| e.to_string())?;
            }

            Ok(TwitterApiResponse {
                success: false,
                tweet_id: None,
                message: format!("投稿に失敗しました: {}", error),
            })
        }
    }
}
