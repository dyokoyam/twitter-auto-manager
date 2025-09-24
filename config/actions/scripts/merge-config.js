#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const ACTIONS_DIR = path.join(ROOT_DIR, 'config', 'actions');

const FILES = {
  user: path.join(ACTIONS_DIR, 'user-config.json'),
  state: path.join(ACTIONS_DIR, 'system-state.json'),
  output: path.join(ACTIONS_DIR, 'github-config.json')
};

function readJson(filePath, defaultValue = {}) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return defaultValue;
    }
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue;
    }
    throw new Error(`Failed to read JSON from ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, data) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(filePath, json, 'utf-8');
}

function normaliseAccountKey(account) {
  if (!account || typeof account !== 'object') return null;
  if (account.id != null) {
    return `id:${account.id}`;
  }
  if (account.account_name) {
    return `name:${account.account_name}`;
  }
  return null;
}

function createLookup(entries, keyFactory) {
  const map = new Map();
  if (!Array.isArray(entries)) return map;
  for (const entry of entries) {
    const key = keyFactory(entry);
    if (key) {
      map.set(key, entry);
    }
  }
  return map;
}

function mergeBots(userBots, botStateLookup) {
  if (!Array.isArray(userBots)) return [];
  return userBots.map((bot) => {
    const key = normaliseAccountKey(bot.account);
    const state = key ? botStateLookup.get(key) : undefined;
    const currentIndex = state && Number.isInteger(state.current_index) ? state.current_index : 0;
    return {
      ...bot,
      current_index: currentIndex
    };
  });
}

function mergeReplySettings(userReplies, replyStateLookup) {
  if (!Array.isArray(userReplies)) return [];
  return userReplies.map((setting) => {
    const key = setting.id != null ? `id:${setting.id}` : `reply:${setting.reply_bot_id}`;
    const state = replyStateLookup.get(key);
    const lastChecked = typeof state?.last_checked_tweet_ids === 'string' ? state.last_checked_tweet_ids : '[]';
    return {
      ...setting,
      last_checked_tweet_ids: lastChecked
    };
  });
}

function main() {
  const userConfig = readJson(FILES.user, {});
  const systemState = readJson(FILES.state, {});

  const botStateLookup = createLookup(systemState.bot_state, (entry) => {
    if (entry.account_id != null) return `id:${entry.account_id}`;
    if (entry.account_name) return `name:${entry.account_name}`;
    return null;
  });

  const replyStateLookup = createLookup(systemState.reply_state, (entry) => {
    if (entry.id != null) return `id:${entry.id}`;
    if (entry.reply_bot_id != null) return `reply:${entry.reply_bot_id}`;
    return null;
  });

  const merged = {
    ...userConfig,
    bots: mergeBots(userConfig.bots, botStateLookup),
    reply_settings: mergeReplySettings(userConfig.reply_settings, replyStateLookup)
  };

  if (systemState.version && !merged.version) {
    merged.version = systemState.version;
  }

  if (!merged.updated_at) {
    merged.updated_at = typeof systemState.updated_at === 'string' ? systemState.updated_at : new Date().toISOString();
  }

  writeJson(FILES.output, merged);
  console.log(`Merged configuration written to ${FILES.output}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

