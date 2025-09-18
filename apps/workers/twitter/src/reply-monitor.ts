#!/usr/bin/env node

import { runtime as config, loadConfig, saveConfig } from './shared/config';
import { logger as log } from './shared/logger';
import { createTwitterClient } from './shared/twitter-client';

function getJapanTime(): string {
  return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getBotAccountById(configData: any, botId: number | string) {
  const id = parseInt(String(botId));
  const bot = (configData.bots || []).find((b: any) => parseInt(String(b?.account?.id)) === id);
  return bot?.account || null;
}

function getBotNameById(configData: any, botId: number | string) {
  const acc = getBotAccountById(configData, botId);
  return acc?.account_name || `Bot_${botId}`;
}

function parseLastCheckedMap(setting: any): Map<string, string> {
  const map = new Map<string, string>();
  const raw = setting.last_checked_tweet_ids;
  if (!raw) return map;
  try {
    const arr = JSON.parse(raw) as string[];
    for (const entry of arr) {
      const [k, v] = String(entry).split(':');
      if (k && v) map.set(k, v);
    }
  } catch {}
  return map;
}

function serializeLastCheckedMap(m: Map<string, string>): string {
  const out: string[] = [];
  for (const [k, v] of m.entries()) out.push(`${k}:${v}`);
  return JSON.stringify(out);
}

async function postReply(client: any, content: string, tweetId: string, botName: string) {
  try {
    if (config.dryRun) {
      log.info(`[DRY RUN] Would reply for ${botName} to ${tweetId}: "${content}"`);
      return { data: { id: 'dry_run_reply_' + Date.now(), text: content }, success: true };
    }
    const response = await client.v2.tweet(content, { reply: { in_reply_to_tweet_id: tweetId } });
    if (response?.data) {
      log.info(`✅ Replied for ${botName}: ${response.data.id}`);
      return { ...response, success: true };
    }
    throw new Error('No data in response');
  } catch (e: any) {
    log.error(`Failed to post reply for ${botName}: ${e?.message}`);
    return { success: false, error: e?.message };
  }
}

async function getUserTweets(client: any, username: string, sinceId?: string | null) {
  try {
    if (config.dryRun) {
      return { data: sinceId ? [] : [{ id: 'dry_run_tweet_' + Date.now(), text: 'dry run', created_at: new Date().toISOString() }], success: true };
    }
    const userResponse = await client.v2.userByUsername(username);
    if (!userResponse?.data) throw new Error(`User ${username} not found`);
    const userId = userResponse.data.id;
    const options: any = { max_results: 5, 'tweet.fields': ['created_at', 'conversation_id', 'author_id'], exclude: 'retweets,replies' };
    if (sinceId) options.since_id = sinceId;
    const tweetsResponse = await client.v2.userTimeline(userId, options);
    const tweets: any[] = tweetsResponse?.data?.data || tweetsResponse?.data || [];
    return { data: tweets, success: true };
  } catch (e: any) {
    log.error(`Failed fetching tweets for ${username}: ${e?.message}`);
    return { data: [], success: false };
  }
}

async function processReplies(configData: any) {
  let successCount = 0;
  let errorCount = 0;
  let configUpdated = false;

  const settings = (configData.reply_settings || []).filter((s: any) => s?.is_active);
  for (let i = 0; i < settings.length; i++) {
    const setting = settings[i];
    try {
      const replyBotAccount = getBotAccountById(configData, setting.reply_bot_id);
      if (!replyBotAccount) continue;
      const replyClient = createTwitterClient(replyBotAccount);

      const targetIds: number[] = JSON.parse(setting.target_bot_ids || '[]');
      const lastMap = parseLastCheckedMap(setting);
      for (const targetId of targetIds) {
        const targetAcc = getBotAccountById(configData, targetId);
        if (!targetAcc) continue;
        const sinceId = lastMap.get(String(targetId));
        const tweets = await getUserTweets(replyClient, targetAcc.account_name, sinceId);
        if (tweets.data && tweets.data.length > 0) {
          const latest = tweets.data[0];
          const res = await postReply(replyClient, setting.reply_content, latest.id, replyBotAccount.account_name);
          if (res.success) {
            successCount++;
            lastMap.set(String(targetId), String(latest.id));
            configUpdated = true;
          } else {
            errorCount++;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (configUpdated) {
        setting.last_checked_tweet_ids = serializeLastCheckedMap(lastMap);
      }
    } catch (e: any) {
      errorCount++;
      log.error(`Error processing reply setting: ${e?.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (configUpdated) {
    log.info('💾 Saving updated reply settings...');
    saveConfig(configData);
  }
  return { successCount, errorCount };
}

async function main() {
  log.info('🚀 Starting Twitter Auto Manager - REPLY MONITOR (TS)');
  log.info(`📊 Env: ${process.env.NODE_ENV || 'production'} | Dry run: ${config.dryRun}`);
  log.info(`⏰ JST time: ${getJapanTime()}`);

  const cfg = loadConfig();
  if (!cfg) {
    log.error('No configuration found');
    process.exit(1);
    return;
  }

  const res = await processReplies(cfg);
  log.info(`💬 Result: ${res.successCount} success, ${res.errorCount} errors`);
  if (res.errorCount > 0) process.exit(1);
}

main().catch((e) => {
  log.error(`💥 Script failed: ${e?.message}`);
  process.exit(1);
});

