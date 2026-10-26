import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  LoginInputSchema,
  RegisterInputSchema,
  UpdateProfileInputSchema,
  type LoginInput,
  type MessageResponse,
  type RegisterInput,
  type UpdateProfileInput,
} from "@moneymind/shared";
import { env } from "../../config/env.js";
import { sendError, sendSuccess } from "../../lib/api-response.js";
import { getAuth, requireAuth } from "../../middleware/authenticate.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { toAuthenticatedUser } from "./auth.mapper.js";
import {
  getCurrentUser,
  listSessions,
  loginUser,
  logout,
  refreshSession,
  registerUser,
  requestContext,
  revokeAllSessions,
  revokeSession,
  updateProfile,
  type IssuedSession,
} from "./auth.service.js";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./cookies.js";

export const authRouter: Router = Router();

function authLimiter(message: string, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs: env.auth.rateLimit.windowMs,
    limit: env.auth.rateLimit.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      sendError(res, 429, "RATE_LIMITED", message, req.id);
    },
  });
}

const loginLimiter = authLimiter("Too many sign-in attempts. Try again in a few minutes.", true);
const registerLimiter = authLimiter("Too many accounts created. Try again later.");

const SessionParamsSchema = z.object({ sessionId: z.uuid() });

function issueCookieAndRespond(res: Response, issued: IssuedSession, status: number): Response {
  setRefreshCookie(res, issued.refreshToken, issued.refreshExpiresAt);
  return sendSuccess(res, issued.payload, { status });
}

authRouter.post(
  "/auth/register",
  registerLimiter,
  validateBody<RegisterInput>(RegisterInputSchema),
  async (req: Request, res: Response) => {
    const issued = await registerUser(req.body as RegisterInput, requestContext(req));
    issueCookieAndRespond(res, issued, 201);
  },
);

authRouter.post(
  "/auth/login",
  loginLimiter,
  validateBody<LoginInput>(LoginInputSchema),
  async (req: Request, res: Response) => {
    const issued = await loginUser(req.body as LoginInput, requestContext(req));
    issueCookieAndRespond(res, issued, 200);
  },
);

authRouter.post("/auth/refresh", async (req: Request, res: Response) => {
  try {
    const issued = await refreshSession(readRefreshCookie(req), requestContext(req));
    issueCookieAndRespond(res, issued, 200);
  } catch (error) {
    // A failed refresh can never be retried with the same cookie.
    clearRefreshCookie(res);
    throw error;
  }
});

authRouter.post("/auth/logout", async (req: Request, res: Response) => {
  await logout(readRefreshCookie(req));
  clearRefreshCookie(res);

  const payload: MessageResponse["data"] = { message: "You have been signed out." };
  sendSuccess(res, payload);
});

authRouter.post("/auth/logout-all", requireAuth, async (req: Request, res: Response) => {
  const auth = getAuth(req);
  await revokeAllSessions(auth.userId);
  clearRefreshCookie(res);

  const payload: MessageResponse["data"] = { message: "All sessions have been signed out." };
  sendSuccess(res, payload);
});

authRouter.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const auth = getAuth(req);
  const { user, session } = await getCurrentUser(auth.userId, auth.sessionId);

  sendSuccess(res, { user: toAuthenticatedUser(user), session });
});

authRouter.patch(
  "/auth/me",
  requireAuth,
  validateBody<UpdateProfileInput>(UpdateProfileInputSchema),
  async (req: Request, res: Response) => {
    const auth = getAuth(req);
    const user = await updateProfile(auth.userId, req.body as UpdateProfileInput);
    sendSuccess(res, { user: toAuthenticatedUser(user) });
  },
);

authRouter.get("/auth/sessions", requireAuth, async (req: Request, res: Response) => {
  const auth = getAuth(req);
  const sessions = await listSessions(auth.userId, auth.sessionId);
  sendSuccess(res, { sessions });
});

authRouter.delete(
  "/auth/sessions/:sessionId",
  requireAuth,
  validateParams(SessionParamsSchema),
  async (req: Request, res: Response) => {
    const auth = getAuth(req);
    const { sessionId } = req.params as z.infer<typeof SessionParamsSchema>;

    await revokeSession(auth.userId, sessionId);

    if (sessionId === auth.sessionId) {
      clearRefreshCookie(res);
    }

    const payload: MessageResponse["data"] = { message: "Session signed out." };
    sendSuccess(res, payload);
  },
);
