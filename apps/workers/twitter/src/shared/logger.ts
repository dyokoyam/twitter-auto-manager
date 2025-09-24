export type LogLevel = "debug" | "info" | "warn" | "error";

function ts(level: LogLevel){ return `[${level.toUpperCase()}] ${new Date().toISOString()}` }

export const logger = {
  debug: (m: string) => console.log(ts("debug"), m),
  info: (m: string) => console.log(ts("info"), m),
  warn: (m: string) => console.warn(ts("warn"), m),
  error: (m: string) => console.error(ts("error"), m),
};
