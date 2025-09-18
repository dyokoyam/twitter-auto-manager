import { z } from "zod";

export const PlanTypeSchema = z.enum(["starter", "basic", "pro"]);

export const UserSettingsSchema = z.object({
  id: z.number().int().positive().optional(),
  user_id: z.string().default("default"),
  plan_type: PlanTypeSchema.default("starter"),
  max_accounts: z.number().int().nonnegative().default(1),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type PlanType = z.infer<typeof PlanTypeSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
