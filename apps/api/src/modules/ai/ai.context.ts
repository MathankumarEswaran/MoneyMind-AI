import type { Request } from "express";
import { getAuth } from "../../middleware/authenticate.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";

export interface AiContext {
  userId: string;
  sessionId: string;
  workspaceId: string;
  currency: string;
  timezone: string;
}

export async function loadAiContext(req: Request): Promise<AiContext> {
  const auth = getAuth(req);

  const membership = await prisma.membership.findFirst({
    where: { userId: auth.userId },
    orderBy: { createdAt: "asc" },
    include: {
      workspace: {
        select: { id: true, baseCurrency: true },
      },
      user: {
        select: { timezone: true },
      },
    },
  });

  if (!membership) {
    throw new AppError(403, "NO_WORKSPACE", "No workspace is associated with this account.");
  }

  return {
    userId: auth.userId,
    sessionId: auth.sessionId,
    workspaceId: membership.workspaceId,
    currency: membership.workspace.baseCurrency,
    timezone: membership.user.timezone,
  };
}
