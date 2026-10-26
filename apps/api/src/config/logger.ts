import pino from "pino";
import { env } from "./env.js";

const transport = env.isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
        singleLine: false,
      },
    }
  : undefined;

/**
 * Structured JSON logs in production; human-readable output in development.
 * Sensitive values are scrubbed even if a future logger call includes them.
 */
export const logger = pino({
  level: env.logLevel,
  base: env.isProd ? { service: "moneymind-api" } : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "apiKey",
    ],
    censor: "[redacted]",
  },
  ...(transport ? { transport } : {}),
});

export type Logger = typeof logger;
