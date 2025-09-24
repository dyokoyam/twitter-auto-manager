import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { type ActionsConfig, mergeUserAndState, SystemStateSchema } from "@tam/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type RuntimeConfig = {
  userConfigPath: string;
  systemStatePath: string;
  logLevel: string;
  dryRun: boolean;
  timezone: string;
};

export const runtime: RuntimeConfig = {
  userConfigPath: process.env.USER_CONFIG_PATH || join(__dirname, "../../../../../config/actions/user-config.json"),
  systemStatePath: process.env.SYSTEM_STATE_PATH || join(__dirname, "../../../../../config/actions/system-state.json"),
  logLevel: process.env.LOG_LEVEL || "info",
  dryRun: process.env.DRY_RUN === "true",
  timezone: "Asia/Tokyo"
};

export function loadConfig(): ActionsConfig | null {
  if (!existsSync(runtime.userConfigPath)) {
    return null;
  }

  const userConfigRaw = JSON.parse(readFileSync(runtime.userConfigPath, "utf8"));
  const stateRaw = existsSync(runtime.systemStatePath)
    ? JSON.parse(readFileSync(runtime.systemStatePath, "utf8"))
    : null;

  try {
    return mergeUserAndState(userConfigRaw, stateRaw);
  } catch (error) {
    console.error(`Failed to merge configuration: ${(error as Error).message}`);
    return null;
  }
}

type PersistPayload = {
  bots?: ActionsConfig["bots"];
  reply_settings?: ActionsConfig["reply_settings"];
  meta?: Pick<ActionsConfig, "version" | "updated_at">;
};

const normaliseNumericId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export function saveState(payload: PersistPayload): boolean {
  if (runtime.dryRun) {
    return true;
  }

  try {
    const state = {
      bot_state: payload.bots?.map((bot) => ({
        account_id: normaliseNumericId(bot.account?.id),
        account_name: bot.account?.account_name ?? null,
        current_index: bot.current_index ?? 0
      })),
      reply_state: payload.reply_settings?.map((setting) => ({
        id: normaliseNumericId(setting.id),
        reply_bot_id: normaliseNumericId(setting.reply_bot_id),
        last_checked_tweet_ids: setting.last_checked_tweet_ids ?? "[]"
      })),
      version: payload.meta?.version ?? null,
      updated_at: payload.meta?.updated_at ?? new Date().toISOString()
    } satisfies z.infer<typeof SystemStateSchema>;

    writeFileSync(runtime.systemStatePath, JSON.stringify(state, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error(`Failed to write system state: ${(error as Error).message}`);
    return false;
  }
}