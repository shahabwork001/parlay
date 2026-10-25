import { pino, type Logger } from "pino";

export type { Logger } from "pino";

/** Never log credentials or personal data. Add paths here as features introduce them. */
const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
  "*.refreshToken",
];

export function createLogger(options: { service: string; level: string; pretty: boolean }): Logger {
  return pino({
    level: options.level,
    base: { service: options.service },
    redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(options.pretty
      ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
      : {}),
  });
}
