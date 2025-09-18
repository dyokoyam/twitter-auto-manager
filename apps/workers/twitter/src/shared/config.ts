import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ActionsConfigSchema, type ActionsConfig } from "@tam/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const runtime = {
  configPath: process.env.CONFIG_PATH || join(__dirname, "../../../../../config/actions/github-config.json"),
  logLevel: process.env.LOG_LEVEL || "info",
  dryRun: process.env.DRY_RUN === "true",
  timezone: "Asia/Tokyo",
} as const;

export function loadConfig(): ActionsConfig | null {
  if (!existsSync(runtime.configPath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(runtime.configPath, "utf8"));
  const parsed = ActionsConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function saveConfig(cfg: ActionsConfig): boolean {
  if (runtime.dryRun) {
    return true;
  }

  try {
    writeFileSync(runtime.configPath, JSON.stringify(cfg, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error(`Failed to write GitHub config: ${(error as Error).message}`);
    return false;
  }
}