import type { Prisma, Session, User } from "@prisma/client";
import type { AuthenticatedUser, SessionSummary, UserProfile } from "@moneymind/shared";
import { AppError } from "../../lib/app-error.js";

export type UserWithMemberships = Prisma.UserGetPayload<{
  include: {
    memberships: {
      include: { workspace: true };
    };
  };
}>;

type UserRecord = Pick<
  User,
  "id" | "email" | "name" | "avatarUrl" | "timezone" | "locale" | "emailVerifiedAt" | "createdAt"
>;

export function toUserProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    locale: user.locale,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAuthenticatedUser(user: UserWithMemberships): AuthenticatedUser {
  const membership = user.memberships[0];

  if (!membership) {
    throw new AppError(403, "NO_WORKSPACE", "This account has no workspace membership.", {
      expose: false,
    });
  }

  return {
    ...toUserProfile(user),
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      baseCurrency: membership.workspace.baseCurrency,
      role: membership.role,
      createdAt: membership.workspace.createdAt.toISOString(),
    },
  };
}

export function toSessionSummary(session: Session, currentSessionId: string): SessionSummary {
  return {
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    current: session.id === currentSessionId,
  };
}
