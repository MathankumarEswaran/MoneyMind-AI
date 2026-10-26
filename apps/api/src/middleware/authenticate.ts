import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../modules/auth/tokens.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "../lib/app-error.js";

/**
 * Verifies the short-lived access JWT and attaches its identity to the request.
 * Refresh tokens never authenticate normal API calls; they can only mint a new
 * access token at /auth/refresh.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get("authorization");

  if (!header) {
    throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }

  const [scheme, token, ...rest] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }

  const claims = await verifyAccessToken(token);

  req.auth = {
    userId: claims.userId,
    sessionId: claims.sessionId,
    accessTokenExpiresAt: claims.expiresAt,
  };

  next();
}

export function getAuth(req: Request): NonNullable<Request["auth"]> {
  if (!req.auth) {
    throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }

  return req.auth;
}

/**
 * Cost of one indexed lookup, paid only by modules that touch mutable money
 * data. Access tokens are stateless, so without this a revoked session could
 * keep reading or writing the ledger until the token expired.
 */
export async function requireActiveSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId, sessionId } = getAuth(req);

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!session) {
    throw new AppError(401, "SESSION_REVOKED", "Your session is no longer active. Sign in again.");
  }

  next();
}
