#!/usr/bin/env node

import type { ActionsConfig, Account, ReplySettings } from '@tam/shared';
import { runtime as config, loadConfig, saveState } from './shared/config.js';
import { logger as log } from './shared/logger.js';
import { createTwitterClient } from './shared/twitter-client.js';
import { delay, formatJapanDateTime } from './shared/time.js';

type ReplyWorkerSetting = ReplySettings & { is_active?: boolean };

type LastCheckedMap = Map<string, string>;

type ReplyResult = {
  successCount: number;
  errorCount: number;
};

const REPLY_DELAY_MS = 1000;

const buildAccountIndex = (configData: ActionsConfig) => {
  const index = new Map<string, Account>();
  for (const bot of configData.bots ?? []) {
    const account = bot.account;
    const key = account?.id;
    if (!account || key === undefined || key === null) {
      continue;
    }
    index.set(String(key), account);
  }
  return index;
};

const parseLastCheckedMap = (setting: ReplyWorkerSetting): LastCheckedMap => {
  const map: LastCheckedMap = new Map();
  if (!setting.last_checked_tweet_ids) {
    return map;
  }

  try {
    const tokens = JSON.parse(setting.last_checked_tweet_ids) as string[];
    for (const token of tokens) {
      const [key, value] = String(token).split(':');
      if (key && value) {
        map.set(key, value);
      }
    }
  } catch (error) {
    log.warn(`Failed to parse last_checked_tweet_ids: ${(error as Error).message}`);
  }

  return map;
};

const serializeLastCheckedMap = (map: LastCheckedMap) =>
  JSON.stringify([...map.entries()].map(([key, value]) => `${key}:${value}`));

const parseTargetIds = (payload: string) => {
  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }
    return parsed.map((id) => String(id)).filter(Boolean);
  } catch (error) {
    log.warn(`Failed to parse target_bot_ids: ${(error as Error).message}`);
    return [] as string[];
  }
};

const postReply = async (client: any, content: string, tweetId: string, botName: string) => {
  if (config.dryRun) {
    log.info(`[dry-run] reply for ${botName} -> ${tweetId}: "${content}"`);
    return { success: true } as const;
  }

  try {
    const response = await client.v2.tweet(content, { reply: { in_reply_to_tweet_id: tweetId } });
    if (!response?.data) {
      throw new Error('Empty response from Twitter API');
    }
    log.info(`[posted] reply for ${botName}: ${response.data.id}`);
    return { success: true } as const;
  } catch (error: any) {
    log.error(`Failed to post reply for ${botName}: ${error?.message}`);
    return { success: false } as const;
  }
};

const getLatestTweetId = async (client: any, username: string, sinceId?: string | null) => {
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
      max_results: 1,
      'tweet.fields': ['created_at', 'conversation_id', 'author_id'],
      exclude: 'retweets,replies',
    };
    if (sinceId) {
      options.since_id = sinceId;
    }

    const timeline = await client.v2.userTimeline(userResponse.data.id, options);
    const tweets: any[] = timeline?.data?.data ?? timeline?.data ?? [];
    const latest = tweets.find((item) => item?.id);
    return latest ? String(latest.id) : null;
  } catch (error: any) {
    log.error(`Failed fetching tweets for ${username}: ${error?.message}`);
    return null;
  }
};

const processReplies = async (configData: ActionsConfig): Promise<ReplyResult> => {
  const accountIndex = buildAccountIndex(configData);
  const settings = (configData.reply_settings ?? []) as ReplyWorkerSetting[];

  let successCount = 0;
  let errorCount = 0;
  let shouldPersist = false;

  for (const setting of settings) {
    const isActive = setting?.is_active !== false;
    if (!isActive) {
      continue;
    }

    const replyAccount = accountIndex.get(String(setting.reply_bot_id));
    if (!replyAccount || replyAccount.status === 'inactive') {
      continue;
    }

    let client: any;
    try {
      client = createTwitterClient(replyAccount);
    } catch (error: any) {
      log.error(`Missing credentials for ${replyAccount.account_name}: ${error?.message}`);
      errorCount++;
      continue;
    }

    const lastChecked = parseLastCheckedMap(setting);
    const targetIds = parseTargetIds(setting.target_bot_ids || '[]');
    let settingUpdated = false;

    for (const targetId of targetIds) {
      const targetAccount = accountIndex.get(targetId);
      if (!targetAccount) {
        continue;
      }

      const sinceId = lastChecked.get(targetId);
      const latestId = await getLatestTweetId(client, targetAccount.account_name, sinceId);
      if (!latestId || latestId === sinceId) {
        continue;
      }

      const result = await postReply(client, setting.reply_content, latestId, replyAccount.account_name);
      if (result.success) {
        successCount++;
        lastChecked.set(targetId, latestId);
        settingUpdated = true;
      } else {
        errorCount++;
      }

      if (!config.dryRun) {
        await delay(REPLY_DELAY_MS);
      }
    }

    if (settingUpdated) {
      setting.last_checked_tweet_ids = serializeLastCheckedMap(lastChecked);
      shouldPersist = true;
    }
  }

  if (shouldPersist) {
    log.info('[persist] saving updated reply settings');
    saveState({
      bots: configData.bots,
      reply_settings: configData.reply_settings,
      meta: { version: configData.version, updated_at: configData.updated_at }
    });
  }

  return { successCount, errorCount };
};

const main = async () => {
  log.info('[init] Twitter Auto Manager - reply monitor worker');
  log.info(`[env] node=${process.version} | NODE_ENV=${process.env.NODE_ENV || 'production'} | dryRun=${config.dryRun}`);
  log.info(`[time] JST ${formatJapanDateTime()}`);

  const cfg = loadConfig();
  if (!cfg) {
    log.error('No configuration found');
    process.exit(1);
    return;
  }

  const { successCount, errorCount } = await processReplies(cfg);
  log.info(`[result] success=${successCount} error=${errorCount}`);
  if (errorCount > 0) process.exit(1);
};

main().catch((error: any) => {
  log.error(`Worker failed: ${error?.message}`);
  process.exit(1);
});
