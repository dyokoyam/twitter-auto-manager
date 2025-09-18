#!/usr/bin/env node

import { runtime as config, loadConfig, saveConfig } from "./shared/config.js";
import { logger as log } from "./shared/logger.js";
import { createTwitterClient } from "./shared/twitter-client.js";

type BotAccount = {
  id?: number | string;
  account_name: string;
  status?: string;
};

type ReplySetting = {
  reply_bot_id: number | string;
  target_bot_ids: string;
  reply_content: string;
  last_checked_tweet_ids?: string | null;
};

const PAUSE_MS = 1000;

function getJapanTime(): string {
  return new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function findAccount(configData: any, targetId: number | string): BotAccount | null {
  const id = Number(targetId);
  if (Number.isNaN(id)) return null;
  const match = (configData.bots || []).find((entry: any) => Number(entry?.account?.id) === id);
  return match?.account ?? null;
}

function parseLastCheckedMap(setting: ReplySetting): Map<string, string> {
  const map = new Map<string, string>();
  if (!setting.last_checked_tweet_ids) return map;
  try {
    const entries = JSON.parse(setting.last_checked_tweet_ids) as string[];
    for (const token of entries) {
      const [key, value] = String(token).split(":");
      if (key && value) map.set(key, value);
    }
  } catch (error) {
    log.warn(`Failed to parse last_checked_tweet_ids: ${(error as Error).message}`);
  }
  return map;
}

function serializeLastCheckedMap(map: Map<string, string>): string {
  return JSON.stringify([...map.entries()].map(([key, value]) => `${key}:${value}`));
}

async function postReply(client: any, content: string, tweetId: string, botName: string) {
  if (config.dryRun) {
    log.info(`[DRY RUN] Would reply for ${botName} to ${tweetId}: "${content}"`);
    return { success: true };
  }

  try {
    const response = await client.v2.tweet(content, { reply: { in_reply_to_tweet_id: tweetId } });
    if (!response?.data) throw new Error("No data in response");
    log.info(`✉️ Replied for ${botName}: ${response.data.id}`);
    return { success: true };
  } catch (error: any) {
    log.error(`Failed to post reply for ${botName}: ${error?.message}`);
    return { success: false };
  }
}

async function getLatestTweetId(client: any, username: string, sinceId?: string | null): Promise<string | null> {
  if (config.dryRun) {
    return sinceId ? null : `dry_run_tweet_${Date.now()}`;
  }

  try {
    const userResponse = await client.v2.userByUsername(username);
    if (!userResponse?.data) {
      log.warn(`User ${username} not found`);
      return null;
    }

    const options: Record<string, unknown> = {
      max_results: 5,
      "tweet.fields": ["created_at", "conversation_id", "author_id"],
      exclude: "retweets,replies",
    };
    if (sinceId) options.since_id = sinceId;

    const timeline = await client.v2.userTimeline(userResponse.data.id, options);
    const tweets: any[] = timeline?.data?.data ?? timeline?.data ?? [];
    return tweets.length > 0 ? String(tweets[0]?.id ?? "") : null;
  } catch (error: any) {
    log.error(`Failed fetching tweets for ${username}: ${error?.message}`);
    return null;
  }
}

async function processReplies(configData: any) {
  const settings = (configData.reply_settings || []).filter((item: ReplySetting & { is_active?: boolean }) => item?.is_active);

  let successCount = 0;
  let errorCount = 0;
  let configUpdated = false;

  for (const setting of settings) {
    const replyBot = findAccount(configData, setting.reply_bot_id);
    if (!replyBot || replyBot.status === "inactive") continue;

    const replyClient = createTwitterClient(replyBot);
    const targets: number[] = JSON.parse(setting.target_bot_ids || "[]");
    const lastMap = parseLastCheckedMap(setting);

    for (const targetId of targets) {
      const targetAccount = findAccount(configData, targetId);
      if (!targetAccount) continue;

      const sinceId = lastMap.get(String(targetId));
      const latestId = await getLatestTweetId(replyClient, targetAccount.account_name, sinceId);
      if (!latestId || latestId === sinceId) continue;

      const result = await postReply(replyClient, setting.reply_content, latestId, replyBot.account_name);
      if (result.success) {
        successCount++;
        lastMap.set(String(targetId), latestId);
        configUpdated = true;
      } else {
        errorCount++;
      }

      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }

    if (configUpdated) {
      setting.last_checked_tweet_ids = serializeLastCheckedMap(lastMap);
    }
  }

  if (configUpdated) {
    log.info("💾 Saving updated reply settings...");
    saveConfig(configData);
  }

  return { successCount, errorCount };
}

async function main() {
  log.info("🚀 Starting Twitter Auto Manager - REPLY MONITOR (TS)");
  log.info(`📊 Env: ${process.env.NODE_ENV || "production"} | Dry run: ${config.dryRun}`);
  log.info(`⏰ JST time: ${getJapanTime()}`);

  const cfg = loadConfig();
  if (!cfg) {
    log.error("No configuration found");
    process.exit(1);
    return;
  }

  const result = await processReplies(cfg);
  log.info(`💬 Result: ${result.successCount} success, ${result.errorCount} errors`);
  if (result.errorCount > 0) process.exit(1);
}

main().catch((error: any) => {
  log.error(`💥 Script failed: ${error?.message}`);
  process.exit(1);
});