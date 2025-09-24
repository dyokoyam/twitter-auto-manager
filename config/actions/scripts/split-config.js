#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const ACTIONS_DIR = path.join(ROOT_DIR, 'config', 'actions');

const FILES = {
  source: path.join(ACTIONS_DIR, 'github-config.json'),
  user: path.join(ACTIONS_DIR, 'user-config.json'),
  state: path.join(ACTIONS_DIR, 'system-state.json')
};

function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.trim()) {
    throw new Error(`Source file ${filePath} is empty.`);
  }
  return JSON.parse(content);
}

function writeJson(filePath, data) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(filePath, json, 'utf-8');
}

function toBotState(bot) {
  const account = bot.account ?? {};
  return {
    account_id: account.id ?? null,
    account_name: account.account_name ?? null,
    current_index: Number.isInteger(bot.current_index) ? bot.current_index : 0
  };
}

function toReplyState(setting) {
  return {
    id: setting.id ?? null,
    reply_bot_id: setting.reply_bot_id ?? null,
    last_checked_tweet_ids: typeof setting.last_checked_tweet_ids === 'string'
      ? setting.last_checked_tweet_ids
      : '[]'
  };
}

function stripBotDynamicFields(bot) {
  const clone = { ...bot };
  delete clone.current_index;
  return clone;
}

function stripReplyDynamicFields(setting) {
  const clone = { ...setting };
  delete clone.last_checked_tweet_ids;
  return clone;
}

function main() {
  if (!fs.existsSync(FILES.source)) {
    throw new Error(`Source file ${FILES.source} not found.`);
  }

  const config = readJson(FILES.source);

  const bots = Array.isArray(config.bots) ? config.bots : [];
  const replySettings = Array.isArray(config.reply_settings) ? config.reply_settings : [];

  const userConfig = {
    ...config,
    bots: bots.map(stripBotDynamicFields),
    reply_settings: replySettings.map(stripReplyDynamicFields)
  };

  const systemState = {
    version: config.version ?? null,
    updated_at: config.updated_at ?? new Date().toISOString(),
    bot_state: bots.map(toBotState),
    reply_state: replySettings.map(toReplyState)
  };

  writeJson(FILES.user, userConfig);
  writeJson(FILES.state, systemState);

  console.log(`User config written to ${FILES.user}`);
  console.log(`System state written to ${FILES.state}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}

