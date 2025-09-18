import { z } from "zod";

/**
 * Twitter アカウント資格情報スキーマ。
 * 取得元によって ID が string / number の両方になるため union で吸収させる。
 */
export const AccountSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  account_name: z.string().min(1, "account_name is required"),
  api_type: z.enum(["Free", "Basic", "Pro"]).default("Free"),
  api_key: z.string().optional(),
  api_key_secret: z.string().optional(),
  access_token: z.string().optional(),
  access_token_secret: z.string().optional(),
  status: z.enum(["active", "inactive", "error"]).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Bot 個別設定。scheduled_content_list は JSON 文字列でも配列でも許容する。
 */
export const BotSchema = z.object({
  account: AccountSchema,
  scheduled_content_list: z.union([z.string(), z.array(z.string())]).optional(),
  scheduled_content: z.string().nullable().optional(),
  current_index: z.number().int().nonnegative().optional(),
  scheduled_times: z.string().nullable().optional(),
});

/**
 * 返信設定。監視対象は JSON 文字列 (既存フォーマット) を維持しつつ型安全に扱えるようにする。
 */
export const ReplySettingsSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  target_bot_ids: z.string(),
  reply_bot_id: z.union([z.number(), z.string()]),
  reply_content: z.string().min(1, "reply_content is required"),
  is_active: z.boolean().default(true),
  last_checked_tweet_ids: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Account = z.infer<typeof AccountSchema>;
export type Bot = z.infer<typeof BotSchema>;
export type ReplySettings = z.infer<typeof ReplySettingsSchema>;
