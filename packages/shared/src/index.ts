import { z } from "zod";

export const AccountSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  account_name: z.string(),
  api_key: z.string().optional(),
  api_key_secret: z.string().optional(),
  access_token: z.string().optional(),
  access_token_secret: z.string().optional(),
  status: z.string().optional(),
});

export const BotSchema = z.object({
  account: AccountSchema,
  scheduled_content_list: z.union([z.string(), z.array(z.string())]).optional(),
  scheduled_content: z.string().nullable().optional(),
  current_index: z.number().optional(),
  scheduled_times: z.string().nullable().optional(),
});

export const ReplySchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  target_bot_ids: z.string(),
  reply_bot_id: z.union([z.number(), z.string()]),
  reply_content: z.string(),
  is_active: z.boolean().optional(),
  last_checked_tweet_ids: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const ActionsConfigSchema = z.object({
  version: z.string().optional(),
  bots: z.array(BotSchema),
  reply_settings: z.array(ReplySchema).optional(),
  updated_at: z.string().optional(),
});

export type ActionsConfig = z.infer<typeof ActionsConfigSchema>;

