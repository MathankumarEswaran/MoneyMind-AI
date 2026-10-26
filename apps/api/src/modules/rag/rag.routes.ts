import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { RAGQueryRequestSchema } from "@moneymind/shared";
import type { RAGQueryRequest } from "@moneymind/shared";
import { env } from "../../config/env.js";
import { sendError, sendSuccess } from "../../lib/api-response.js";
import { requireActiveSession, requireAuth } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { loadAiContext } from "../ai/ai.context.js";
import { queryRag } from "./rag.service.js";

export const ragRouter: Router = Router();

ragRouter.use("/rag", requireAuth, requireActiveSession);

const ragLimiter = rateLimit({
  windowMs: env.ai.rateLimit.windowMs,
  limit: env.ai.rateLimit.max,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 429, "RATE_LIMITED", "Too many requests. Please slow down and try again.", req.id);
  },
});

ragRouter.post(
  "/rag/query",
  ragLimiter,
  validateBody<RAGQueryRequest>(RAGQueryRequestSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadAiContext(req);
    const result = await queryRag(ctx, req.body as RAGQueryRequest);
    sendSuccess(res, result);
  },
);
