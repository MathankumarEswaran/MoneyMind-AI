import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { AiChatRequestSchema, IdParamsSchema } from "@moneymind/shared";
import type { AiChatRequest } from "@moneymind/shared";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { sendError, sendSuccess } from "../../lib/api-response.js";
import { requireActiveSession, requireAuth } from "../../middleware/authenticate.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { loadAiContext } from "./ai.context.js";
import { chat, getThread, listThreads } from "./ai.service.js";

export const aiRouter: Router = Router();

aiRouter.use("/ai", requireAuth, requireActiveSession);

const aiLimiter = rateLimit({
  windowMs: env.ai.rateLimit.windowMs,
  limit: env.ai.rateLimit.max,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 429, "RATE_LIMITED", "Too many AI requests. Please slow down and try again.", req.id);
  },
});

aiRouter.get("/ai/threads", async (req: Request, res: Response) => {
  const ctx = await loadAiContext(req);
  const result = await listThreads(ctx);
  sendSuccess(res, result);
});

aiRouter.get(
  "/ai/threads/:id",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadAiContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const result = await getThread(ctx, id);
    sendSuccess(res, result);
  },
);

aiRouter.post(
  "/ai/chat",
  aiLimiter,
  validateBody<AiChatRequest>(AiChatRequestSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadAiContext(req);
    const result = await chat(ctx, req.body as AiChatRequest);
    sendSuccess(res, result);
  },
);
