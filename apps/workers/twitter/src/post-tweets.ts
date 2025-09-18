#!/usr/bin/env node

import { runtime as config, loadConfig, saveConfig } from './shared/config.js';
import { logger as log } from './shared/logger.js';
import { createTwitterClient } from './shared/twitter-client.js';
import { updatePostIndexWithMemory } from './shared/persistence.js';

function getJapanTime(): string {
  return new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function shouldPostNow(scheduledTimes?: string | null): boolean {
  if (!scheduledTimes) return false;
  const parts = scheduledTimes.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  const currentTime = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentHour = currentTime.split(':')[0];
  const scheduledHours = parts.map((p) => p.split(':')[0]);
  return scheduledHours.includes(currentHour);
}

function getPostContentWithMemoryIndex(botConfig: any, memoryIndices: Map<string, number>, accountName: string) {
  if (botConfig.scheduled_content_list) {
    try {
      const contentList = typeof botConfig.scheduled_content_list === 'string'
        ? JSON.parse(botConfig.scheduled_content_list)
        : botConfig.scheduled_content_list;
      if (!Array.isArray(contentList) || contentList.length === 0) return null;
      const currentIndex = memoryIndices.has(accountName)
        ? (memoryIndices.get(accountName) as number)
        : (botConfig.current_index || 0);
      const safeIndex = currentIndex % contentList.length;
      return {
        content: contentList[safeIndex],
        isFromList: true,
        currentIndex,
        listLength: contentList.length,
      };
    } catch (e: any) {
      log.error(`Failed to parse content list for ${accountName}: ${e?.message}`);
      return null;
    }
  }
  if (botConfig.scheduled_content) {
    return { content: botConfig.scheduled_content, isFromList: false };
  }
  return null;
}

async function postTweet(client: any, content: string, botName: string) {
  try {
    if (config.dryRun) {
      log.info(`[DRY RUN] Would post tweet for ${botName}: "${content}"`);
      return { data: { id: 'dry_run_' + Date.now(), text: content }, success: true };
    }
    const res = await client.v2.tweet(content);
    if (res?.data) {
      log.info(`✁EPosted tweet for ${botName}: ${res.data.id}`);
      return { ...res, success: true };
    }
    throw new Error('No data in response');
  } catch (e: any) {
    log.error(`Failed to post tweet for ${botName}: ${e?.message}`);
    return { success: false, error: e?.message };
  }
}

async function processScheduledPosts(configData: any) {
  const memoryIndices = new Map<string, number>();
  let successCount = 0;
  let errorCount = 0;
  let configUpdated = false;

  for (let botIndex = 0; botIndex < (configData.bots || []).length; botIndex++) {
    const bot = configData.bots[botIndex];
    const account = bot?.account;
    if (!account || account.status !== 'active') continue;

    try {
      const scheduledTimes = bot.scheduled_times as string | null;
      if (!shouldPostNow(scheduledTimes)) continue;

      const contentInfo = getPostContentWithMemoryIndex(bot, memoryIndices, account.account_name);
      if (!contentInfo) continue;

      const client = createTwitterClient(account);
      const result = await postTweet(client, contentInfo.content, account.account_name);
      if (result.success) {
        successCount++;
        if (contentInfo.isFromList) {
          const updated = updatePostIndexWithMemory(configData, botIndex, memoryIndices, account.account_name);
          if (updated) configUpdated = true;
        }
      } else {
        errorCount++;
      }
    } catch (e: any) {
      errorCount++;
      log.error(`Error processing ${account?.account_name || 'unknown'}: ${e?.message}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  if (configUpdated) {
    log.info(`💾 Saving updated config indices...`);
    saveConfig(configData);
  }

  return { successCount, errorCount };
}

async function main() {
  log.info('🚀 Starting Twitter Auto Manager - SCHEDULED POSTS (TS)');
  log.info(`📊 Env: ${process.env.NODE_ENV || 'production'} | Dry run: ${config.dryRun}`);
  log.info(`⏰ JST time: ${getJapanTime()}`);

  const cfg = loadConfig();
  if (!cfg || !cfg.bots || cfg.bots.length === 0) {
    log.error('No configuration found or no bots configured');
    process.exit(1);
    return;
  }

  const res = await processScheduledPosts(cfg);
  log.info(`📈 Result: ${res.successCount} success, ${res.errorCount} errors`);
  if (res.errorCount > 0) process.exit(1);
}

main().catch((e) => {
  log.error(`💥 Script failed: ${e?.message}`);
  process.exit(1);
});

