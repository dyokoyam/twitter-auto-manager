import { z } from "zod";
import { ActionsConfigSchema } from "../schema/actions.js";

const BotStateSchema = z.object({
  account_id: z.number().nullable().optional(),
  account_name: z.string().nullable().optional(),
  current_index: z.number().int().nonnegative().default(0)
});

const ReplyStateSchema = z.object({
  id: z.number().nullable().optional(),
  reply_bot_id: z.number().nullable().optional(),
  last_checked_tweet_ids: z.string().default("[]")
});

export const SystemStateSchema = z.object({
  version: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  bot_state: z.array(BotStateSchema).optional(),
  reply_state: z.array(ReplyStateSchema).optional()
});

export type SystemState = z.infer<typeof SystemStateSchema>;

type ActionsConfig = z.infer<typeof ActionsConfigSchema>;

type BotEntry = ActionsConfig["bots"][number];
type ReplyEntry = ActionsConfig["reply_settings"][number];

const toAccountKey = (bot: BotEntry | undefined) => {
  const account = bot?.account;
  if (!account) return null;
  if (account.id != null) return `id:${account.id}`;
  if (account.account_name) return `name:${account.account_name}`;
  return null;
};

const toReplyKey = (setting: ReplyEntry | undefined) => {
  if (!setting) return null;
  if (setting.id != null) return `id:${setting.id}`;
  if (setting.reply_bot_id != null) return `reply:${setting.reply_bot_id}`;
  return null;
};

export function mergeConfigWithState(userConfig: ActionsConfig, state: SystemState | null): ActionsConfig {
  if (!state) {
    return userConfig;
  }

  const botStateLookup = new Map<string, z.infer<typeof BotStateSchema>>();
  const replyStateLookup = new Map<string, z.infer<typeof ReplyStateSchema>>();

  state.bot_state?.forEach((entry) => {
    if (!entry) return;
    const { account_id, account_name } = entry;
    if (account_id != null) {
      botStateLookup.set(`id:${account_id}`, entry);
    }
    if (account_name) {
      botStateLookup.set(`name:${account_name}`, entry);
    }
  });

  state.reply_state?.forEach((entry) => {
    if (!entry) return;
    if (entry.id != null) {
      replyStateLookup.set(`id:${entry.id}`, entry);
    }
    if (entry.reply_bot_id != null) {
      replyStateLookup.set(`reply:${entry.reply_bot_id}`, entry);
    }
  });

  const bots = userConfig.bots?.map((bot) => {
    const key = toAccountKey(bot);
    const match = key ? botStateLookup.get(key) : undefined;
    if (!match) return { ...bot, current_index: bot.current_index ?? 0 };
    const current_index = Number.isInteger(match.current_index) ? match.current_index : 0;
    return {
      ...bot,
      current_index
    } satisfies BotEntry;
  });

  const reply_settings = userConfig.reply_settings?.map((setting) => {
    const key = toReplyKey(setting);
    const match = key ? replyStateLookup.get(key) : undefined;
    const last_checked_tweet_ids = typeof match?.last_checked_tweet_ids === "string"
      ? match.last_checked_tweet_ids
      : setting.last_checked_tweet_ids ?? "[]";
    return {
      ...setting,
      last_checked_tweet_ids
    } satisfies ReplyEntry;
  });

  return {
    ...userConfig,
    version: userConfig.version ?? state.version ?? undefined,
    updated_at: userConfig.updated_at ?? state.updated_at ?? new Date().toISOString(),
    bots,
    reply_settings
  } satisfies ActionsConfig;
}

export function mergeUserAndState(rawUserConfig: unknown, rawState: unknown): ActionsConfig {
  const userConfig = ActionsConfigSchema.parse(rawUserConfig);
  const systemState = SystemStateSchema.safeParse(rawState).success
    ? SystemStateSchema.parse(rawState)
    : null;

  return mergeConfigWithState(userConfig, systemState);
}

