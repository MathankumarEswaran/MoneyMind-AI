import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";

const ISSUER = "moneymind-api";
const AUDIENCE = "moneymind-web";
const ALGORITHM = "HS256";

const accessSecret = new TextEncoder().encode(env.auth.accessSecret);
const refreshSecret = new TextEncoder().encode(env.auth.refreshSecret);

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

export async function signAccessToken(
  userId: string,
  sessionId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAt + env.auth.accessTokenTtlSeconds;

  const token = await new SignJWT({ sid: sessionId, type: "access" })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAtSeconds)
    .setJti(randomUUID())
    .sign(accessSecret);

  return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: 5,
    });

    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Access token is missing required claims");
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch (error) {
    throw new AppError(401, "ACCESS_TOKEN_INVALID", "Your session has expired. Sign in again.", {
      cause: error,
    });
  }
}

export interface RefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Refresh tokens are opaque, high-entropy values. Only a keyed hash is stored,
 * so a database leak cannot be replayed and a stolen hash is useless without
 * JWT_REFRESH_SECRET.
 */
export function createRefreshToken(): RefreshToken {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.auth.refreshTokenTtlMs);

  return { token, tokenHash: hashRefreshToken(token), expiresAt };
}

export function hashRefreshToken(token: string): string {
  return createHmac("sha256", refreshSecret).update(token, "utf8").digest("hex");
}
