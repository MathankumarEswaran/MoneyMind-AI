import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { APP_NAME, APP_VERSION, API_PREFIX } from "@moneymind/shared";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { AppError } from "./lib/app-error.js";
import { sendError, sendSuccess } from "./lib/api-response.js";
import { requestId } from "./middleware/request-id.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";

type RequestWithId = IncomingMessage & { id?: string };

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as RequestWithId).id ?? randomUUID(),
      autoLogging: !env.isTest,
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // The API never renders HTML; the SPA host owns its CSP.
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(
          new AppError(403, "CORS_NOT_ALLOWED", "This origin is not allowed to call the API."),
        );
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      exposedHeaders: ["x-request-id"],
      maxAge: 86_400,
    }),
  );

  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: env.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: env.bodyLimit }));

  app.use(
    API_PREFIX,
    rateLimit({
      windowMs: env.rateLimit.windowMs,
      limit: env.rateLimit.max,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.method === "OPTIONS" || req.path === "/health",
      handler: (req, res) => {
        sendError(
          res,
          429,
          "RATE_LIMITED",
          "Too many requests. Please slow down and try again.",
          req.id,
        );
      },
    }),
  );

  app.get("/", (_req, res) => {
    sendSuccess(res, {
      name: APP_NAME,
      version: APP_VERSION,
      api: API_PREFIX,
      health: `${API_PREFIX}/health`,
    });
  });

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
