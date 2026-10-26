import { Prisma } from "@prisma/client";
import type { AuthSession, LoginInput, RegisterInput, UpdateProfileInput } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { toAuthenticatedUser, toSessionSummary, type UserWithMemberships } from "./auth.mapper.js";
import { fakeVerifyPassword, hashPassword, verifyPassword } from "./password.js";
import { createRefreshToken, hashRefreshToken, signAccessToken } from "./tokens.js";

export interface RequestContext {
  userAgent: string | null;
  ipAddress: string | null;
}

export interface IssuedSession {
  refreshToken: string;
  refreshExpiresAt: Date;
  payload: AuthSession;
}

const userInclude = {
  memberships: {
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.UserInclude;

function sanitizeUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const cleaned = userAgent.replace(/\p{Cc}/gu, "").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 512) : null;
}

export function requestContext(req: {
  get(name: string): string | undefined;
  ip?: string;
}): RequestContext {
  return {
    userAgent: sanitizeUserAgent(req.get("user-agent")),
    ipAddress: req.ip ? req.ip.slice(0, 64) : null,
  };
}

async function findUserWithMemberships(userId: string): Promise<UserWithMemberships> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });

  if (!user) {
    throw new AppError(401, "USER_NOT_FOUND", "This account no longer exists.");
  }

  return user;
}

async function issueSession(
  user: UserWithMemberships,
  context: RequestContext,
): Promise<IssuedSession> {
  const refresh = createRefreshToken();

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: refresh.tokenHash,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: refresh.expiresAt,
    },
  });

  const access = await signAccessToken(user.id, session.id);

  return {
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    payload: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      user: toAuthenticatedUser(user),
    },
  };
}

export async function registerUser(
  input: RegisterInput,
  context: RequestContext,
): Promise<IssuedSession> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const workspaceName = (
    input.workspaceName?.trim() || `${name.split(/\s+/)[0] ?? "Personal"}'s workspace`
  ).slice(0, 80);

  // Hash before opening the transaction so expensive CPU work never holds a
  // database connection or row locks.
  const passwordHash = await hashPassword(input.password);

  let user: UserWithMemberships;

  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, passwordHash, lastLoginAt: new Date() },
      });

      const workspace = await tx.workspace.create({
        data: { name: workspaceName, baseCurrency: "INR" },
      });

      await tx.membership.create({
        data: { userId: created.id, workspaceId: workspace.id, role: "OWNER" },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: userInclude,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.");
    }
    throw error;
  }

  return issueSession(user, context);
}

export async function loginUser(
  input: LoginInput,
  context: RequestContext,
): Promise<IssuedSession> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: userInclude,
  });

  if (!user) {
    await fakeVerifyPassword(input.password);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const valid = await verifyPassword(user.passwordHash, input.password);

  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return issueSession(user, context);
}

export async function refreshSession(
  rawToken: string | null,
  context: RequestContext,
): Promise<IssuedSession> {
  if (!rawToken) {
    throw new AppError(401, "NO_SESSION", "No active session was found. Sign in again.");
  }

  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: userInclude } },
  });

  if (!existing) {
    throw new AppError(401, "NO_SESSION", "No active session was found. Sign in again.");
  }

  // A token that was already rotated or revoked has been replayed. Treat it as
  // theft: end every session for the account instead of minting a new pair.
  if (existing.revokedAt !== null || existing.rotatedAt !== null) {
    await revokeAllSessions(existing.userId);
    throw new AppError(401, "SESSION_REVOKED", "This session was already used. Sign in again.");
  }

  const now = new Date();

  if (existing.expiresAt <= now) {
    await prisma.session.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: now },
    });
    throw new AppError(401, "SESSION_EXPIRED", "Your session has expired. Sign in again.");
  }

  const next = createRefreshToken();

  const rotated = await prisma.$transaction(async (tx) => {
    // The conditional update guarantees exactly one concurrent refresh wins.
    const updated = await tx.session.updateMany({
      where: {
        id: existing.id,
        revokedAt: null,
        rotatedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now, rotatedAt: now, lastUsedAt: now },
    });

    if (updated.count !== 1) return null;

    return tx.session.create({
      data: {
        userId: existing.userId,
        tokenHash: next.tokenHash,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: next.expiresAt,
      },
    });
  });

  if (!rotated) {
    await revokeAllSessions(existing.userId);
    throw new AppError(401, "SESSION_REVOKED", "This session was already used. Sign in again.");
  }

  const access = await signAccessToken(existing.userId, rotated.id);

  return {
    refreshToken: next.token,
    refreshExpiresAt: next.expiresAt,
    payload: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      user: toAuthenticatedUser(existing.user),
    },
  };
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function logout(rawToken: string | null): Promise<void> {
  if (!rawToken) return;

  await prisma.session.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    throw new AppError(404, "SESSION_NOT_FOUND", "That session is no longer active.");
  }
}

export async function getCurrentUser(
  userId: string,
  sessionId: string,
): Promise<{ user: UserWithMemberships; session: ReturnType<typeof toSessionSummary> }> {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: { include: userInclude } },
  });

  if (!session) {
    throw new AppError(401, "SESSION_REVOKED", "Your session is no longer active. Sign in again.");
  }

  return {
    user: session.user,
    session: toSessionSummary(session, sessionId),
  };
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserWithMemberships> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
    },
    include: userInclude,
  });
}

export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    take: 50,
  });

  return sessions.map((session) => toSessionSummary(session, currentSessionId));
}

export { findUserWithMemberships };
