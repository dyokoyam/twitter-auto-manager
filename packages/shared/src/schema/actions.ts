import { z } from "zod";
import { BotSchema, ReplySettingsSchema } from "./bots.js";

export const ActionsConfigSchema = z.object({
  version: z.string().optional(),
  bots: z.array(BotSchema),
  reply_settings: z.array(ReplySettingsSchema).optional(),
  updated_at: z.string().optional(),
});

export type ActionsConfig = z.infer<typeof ActionsConfigSchema>;
