use crate::models::BotAccount;
use crate::utils::crypto::url_encode;

use reqwest::Client;
use serde_json::json;

pub async fn post_to_twitter(account: &BotAccount, content: &str) -> Result<String, String> {
    let url = "https://api.twitter.com/2/tweets";
    let method = "POST";

    let payload = json!({ "text": content }).to_string();

    let authorization_header = create_oauth_header(
        method,
        url,
        &account.api_key,
        &account.api_key_secret,
        &account.access_token,
        &account.access_token_secret,
        Some(&payload),
    )?;

    let client = Client::new();

    let response = client
        .post(url)
        .header("Authorization", authorization_header)
        .header("Content-Type", "application/json")
        .body(payload)
        .send()
        .await
        .map_err(|e| format!("リクエスト送信エラー: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("レスポンス取得エラー: {}", e))?;

    if status.is_success() {
        let json: serde_json::Value =
            serde_json::from_str(&response_text).map_err(|e| format!("JSON解析エラー: {}", e))?;

        if let Some(tweet_id) = json["data"]["id"].as_str() {
            Ok(tweet_id.to_string())
        } else {
            Err("ツイートIDを取得できませんでした".to_string())
        }
    } else {
        Err(format!(
            "Twitter API エラー ({}): {}",
            status, response_text
        ))
    }
}

fn create_oauth_header(
    method: &str,
    url: &str,
    consumer_key: &str,
    consumer_secret: &str,
    access_token: &str,
    access_token_secret: &str,
    _body: Option<&str>,
) -> Result<String, String> {
    use std::collections::BTreeMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let nonce: String = (0..32)
        .map(|_| {
            let chars = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            chars[rand::random::<usize>() % chars.len()] as char
        })
        .collect();

    let mut oauth_params = BTreeMap::new();
    oauth_params.insert("oauth_consumer_key", consumer_key.to_string());
    oauth_params.insert("oauth_nonce", nonce);
    oauth_params.insert("oauth_signature_method", "HMAC-SHA1".to_string());
    oauth_params.insert("oauth_timestamp", timestamp.to_string());
    oauth_params.insert("oauth_token", access_token.to_string());
    oauth_params.insert("oauth_version", "1.0".to_string());

    let param_string = oauth_params
        .iter()
        .map(|(k, v)| format!("{}={}", url_encode(k), url_encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let base_string = format!(
        "{}&{}&{}",
        method,
        url_encode(url),
        url_encode(&param_string)
    );

    let signing_key = format!(
        "{}&{}",
        url_encode(consumer_secret),
        url_encode(access_token_secret)
    );

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use hmac::{Hmac, Mac};
    use sha1::Sha1;

    type HmacSha1 = Hmac<Sha1>;
    let mut mac = HmacSha1::new_from_slice(signing_key.as_bytes())
        .map_err(|e| format!("HMAC初期化エラー: {}", e))?;
    mac.update(base_string.as_bytes());
    let signature = STANDARD.encode(mac.finalize().into_bytes());

    oauth_params.insert("oauth_signature", signature);

    let auth_header = oauth_params
        .iter()
        .map(|(k, v)| format!("{}=\"{}\"", url_encode(k), url_encode(v)))
        .collect::<Vec<_>>()
        .join(", ");

    Ok(format!("OAuth {}", auth_header))
}
