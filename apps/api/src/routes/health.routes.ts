import { Router } from "express";
import {
  APP_NAME,
  APP_VERSION,
  FALLBACK_VERSION,
  type HealthResponse,
  type MetaResponse,
} from "@moneymind/shared";
import { sendSuccess } from "../lib/api-response.js";
import { env } from "../config/env.js";
import { checkDatabase } from "../db/prisma.js";

export const healthRouter: Router = Router();

/**
 * Liveness probe. Intentionally dependency-free so it stays fast and cheap.
 * Readiness checks for Postgres/Qdrant arrive in Phases 2 and 5.
 */
healthRouter.get("/health", (_req, res) => {
  const payload: HealthResponse["data"] = {
    status: "ok",
    service: "moneymind-api",
    version: APP_VERSION || FALLBACK_VERSION,
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      api: "up",
    },
  };

  sendSuccess(res, payload);
});

/**
 * Readiness probe. Unlike /health it verifies the database connection, so
 * orchestrators can delay traffic until persistence is usable.
 */
healthRouter.get("/ready", async (_req, res) => {
  const databaseUp = await checkDatabase();
  const payload: HealthResponse["data"] = {
    status: databaseUp ? "ok" : "degraded",
    service: "moneymind-api",
    version: APP_VERSION || FALLBACK_VERSION,
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      api: "up",
      database: databaseUp ? "up" : "down",
    },
  };

  sendSuccess(res, payload, { status: databaseUp ? 200 : 503 });
});

/**
 * Capability discovery for the SPA. Keeps the UI honest about which phase is
 * live without hardcoding flags in multiple places.
 */
healthRouter.get("/meta", (_req, res) => {
  const payload: MetaResponse["data"] = {
    name: APP_NAME,
    version: APP_VERSION,
    phase: 6,
    environment: env.nodeEnv,
    features: {
      authentication: true,
      database: true,
      transactions: true,
      budgets: true,
      goals: true,
      analytics: true,
      aiChat: env.ai.provider !== "none",
      rag: true,
      vectorSearch: true,
    },
    timestamp: new Date().toISOString(),
  };

  sendSuccess(res, payload);
});
