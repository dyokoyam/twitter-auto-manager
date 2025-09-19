#!/usr/bin/env node

import type { ActionsConfig, Bot } from '@tam/shared';
import { runtime as config, loadConfig, saveConfig } from './shared/config.js';
import { logger as log } from './shared/logger.js';
import { createTwitterClient } from './shared/twitter-client.js';
import { delay, formatJapanDateTime, formatJapanHourMinute } from './shared/time.js';

const POST_DELAY_MS = 1000;

const parseScheduledTimes = (input?: string | null) => {
  if (!input) return [] as string[];
  return input
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
};

const shouldPostNow = (scheduledTimes?: string | null) => {
  const slots = parseScheduledTimes(scheduledTimes);
  if (slots.length === 0) return false;
  return slots.includes(formatJapanHourMinute());
};

type NextContent = {
  content: string;
  nextIndex?: number;
};

const resolveNextContent = (bot: Bot): NextContent | null => {
  if (bot.scheduled_content_list) {
    try {
      const list =
        typeof bot.scheduled_content_list === 'string'
          ? JSON.parse(bot.scheduled_content_list)
          : bot.scheduled_content_list;

      if (!Array.isArray(list) || list.length === 0) {
        return null;
      }

      const currentIndex =
        typeof bot.current_index === 'number' && bot.current_index >= 0
          ? bot.current_index
          : 0;

      const safeIndex = currentIndex % list.length;
      const content = String(list[safeIndex]).trim();
      if (!content) {
        return null;
      }

      return {
        content,
        nextIndex: (safeIndex + 1) % list.length,
      };
    } catch (error) {
      log.error(
        `Failed to parse scheduled_content_list for ${bot.account?.account_name ?? 'unknown'}: ${
          (error as Error).message
        }`,
      );
      return null;
    }
  }

  const single = bot.scheduled_content?.trim();
  return single ? { content: single } : null;
};

const postTweet = async (client: any, content: string, botName: string) => {
  if (config.dryRun) {
    log.info(`[dry-run] tweet for ${botName}: "${content}"`);
    return { success: true, data: { id: `dry_run_${Date.now()}`, text: content } } as const;
  }

  try {
    const response = await client.v2.tweet(content);
    if (!response?.data) {
      throw new Error('Empty response from Twitter API');
    }
    log.info(`[posted] tweet for ${botName}: ${response.data.id}`);
    return { success: true, data: response.data } as const;
  } catch (error: any) {
    log.error(`Failed to post tweet for ${botName}: ${error?.message}`);
    return { success: false, error: error?.message } as const;
  }
};

const processScheduledPosts = async (configData: ActionsConfig) => {
  let successCount = 0;
  let errorCount = 0;
  let shouldPersist = false;

  const bots = configData.bots ?? [];

  for (let index = 0; index < bots.length; index++) {
    const bot = bots[index];
    const account = bot.account;

    if (!account || account.status !== 'active') {
      continue;
    }

    if (!shouldPostNow(bot.scheduled_times ?? null)) {
      continue;
    }

    const nextContent = resolveNextContent(bot);
    if (!nextContent) {
      continue;
    }

    let client: any;
    try {
      client = createTwitterClient(account);
    } catch (error: any) {
      log.error(`Missing credentials for ${account.account_name}: ${error?.message}`);
      errorCount++;
      continue;
    }

    const result = await postTweet(client, nextContent.content, account.account_name);
    if (result.success) {
      successCount++;

      if (typeof nextContent.nextIndex === 'number') {
        bots[index].current_index = nextContent.nextIndex;
        shouldPersist = true;
      }
    } else {
      errorCount++;
    }

    if (!config.dryRun) {
      await delay(POST_DELAY_MS);
    }
  }

  if (shouldPersist) {
    log.info('[persist] saving updated bot indices');
    saveConfig(configData);
  }

  return { successCount, errorCount };
};

const main = async () => {
  log.info('[init] Twitter Auto Manager - scheduled posts worker');
  log.info(`[env] node=${process.version} | NODE_ENV=${process.env.NODE_ENV || 'production'} | dryRun=${config.dryRun}`);
  log.info(`[time] JST ${formatJapanDateTime()}`);

  const cfg = loadConfig();
  if (!cfg || !cfg.bots || cfg.bots.length === 0) {
    log.error('No configuration found or no bots configured');
    process.exit(1);
    return;
  }

  const { successCount, errorCount } = await processScheduledPosts(cfg);
  log.info(`[result] success=${successCount} error=${errorCount}`);
  if (errorCount > 0) process.exit(1);
};

main().catch((error: any) => {
  log.error(`Worker failed: ${error?.message}`);
  process.exit(1);
});
