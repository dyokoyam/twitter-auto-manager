import { ActionsConfigSchema } from "../schema/actions.js";
import type { ActionsConfig } from "../schema/actions.js";

export function parseActionsConfig(raw: unknown): ActionsConfig {
  return ActionsConfigSchema.parse(raw);
}

export function safeParseActionsConfig(raw: unknown) {
  return ActionsConfigSchema.safeParse(raw);
}
