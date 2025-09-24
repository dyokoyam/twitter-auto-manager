#!/usr/bin/env node

import type { ActionsConfig } from '@tam/shared';
import { runtime as config, loadConfig, saveState } from './shared/config.js';
import { logger as log } from './shared/logger.js';
import { postTweet, resolveNextContent } from './shared/posting.js';
import { evaluateSchedule, type ScheduleWindow } from './shared/scheduler.js';
import { createTwitterClient } from './shared/twitter-client.js';
import { delay, formatJapanDateTime } from './shared/time.js';

const POST_DELAY_MS = 1000;

const summarizeWindows = (windows: ScheduleWindow[]) =>
  windows.length > 0 ? windows.map((window) => window.label).join(', ') : 'none';

const processScheduledPosts = async (configData: ActionsConfig) => {
  let successCount = 0;
  let errorCount = 0;
  let shouldPersist = false;

  const bots = configData.bots ?? [];

  for (let index = 0; index < bots.length; index++) {
    const bot = bots[index];
    const account = bot.account;
    const accountName = account?.account_name ?? `bot#${index + 1}`;

    if (!account || account.status !== 'active') {
      log.info(`[skip][account] ${accountName} inactive or missing account configuration`);
      continue;
    }

    const schedule = evaluateSchedule(bot.scheduled_times);
    if (!schedule.shouldPost) {
      if (schedule.reason === 'no_schedule') {
        log.info(`[skip][schedule] ${accountName} no scheduled_times configured | now=${schedule.now.iso}`);
      } else {
        const configured = summarizeWindows(schedule.windows);
        const nextWindowLabel = schedule.nextWindow ? schedule.nextWindow.label : 'n/a';
        log.info(
          `[skip][schedule] ${accountName} outside active window | now=${schedule.now.iso} | configured=${configured} | next=${nextWindowLabel}`,
        );
      }
      continue;
    }

    const contentResolution = resolveNextContent(bot);
    if (contentResolution.status !== 'ok') {
      log.info(`[skip][content] ${accountName} ${contentResolution.reason}`);
      continue;
    }

    const { content, nextIndex, source, listLength, currentIndex } = contentResolution.next;

    let client: any;
    try {
      client = createTwitterClient(account);
    } catch (error: any) {
      errorCount++;
      log.error(`[error][credentials] ${accountName} ${error?.message ?? 'missing credentials'}`);
      continue;
    }

    const windowLabel = schedule.matchedWindow ? schedule.matchedWindow.label : 'unknown';
    if (source === 'list') {
      log.info(
        `[post][pending] ${accountName} window=${windowLabel} listIndex=${currentIndex}/${listLength ?? '?'}`,
      );
    } else {
      log.info(`[post][pending] ${accountName} window=${windowLabel} single-content`);
    }

    const result = await postTweet({
      client,
      content,
      botName: accountName,
      dryRun: config.dryRun,
    });

    if (result.success) {
      successCount++;
      if (typeof nextIndex === 'number') {
        bots[index].current_index = nextIndex;
        shouldPersist = true;
      }
      log.info(`[post][success] ${accountName} tweet=${result.data.id} window=${windowLabel}`);
    } else {
      errorCount++;
      const failureReason = 'error' in result ? result.error : 'unknown error';
      log.error(`[post][failed] ${accountName} reason=${failureReason}`);
    }

    if (!config.dryRun) {
      await delay(POST_DELAY_MS);
    }
  }

  if (shouldPersist) {
    log.info('[persist] saving updated bot indices');
    saveState({
      bots: configData.bots,
      reply_settings: configData.reply_settings,
      meta: { version: configData.version, updated_at: configData.updated_at }
    });
  }

  return { successCount, errorCount };
};

const main = async () => {
  log.info('[init] Twitter Auto Manager - scheduled posts worker');
  log.info(
    `[env] node=${process.version} | NODE_ENV=${process.env.NODE_ENV || 'production'} | dryRun=${config.dryRun}`,
  );
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
