import { TwitterApi } from "twitter-api-v2";

export function createTwitterClient(account: any) {
  if (!account?.api_key || !account?.api_key_secret || !account?.access_token || !account?.access_token_secret) {
    throw new Error("Missing Twitter API credentials");
  }
  return new TwitterApi({
    appKey: account.api_key,
    appSecret: account.api_key_secret,
    accessToken: account.access_token,
    accessSecret: account.access_token_secret,
  });
}
