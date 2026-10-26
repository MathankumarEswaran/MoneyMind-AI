import type { Request } from "express";
import type { WorkspaceRole } from "@moneymind/shared";
import { isValidTimeZone } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { getAuth } from "../../middleware/authenticate.js";

/**
 * Everything a finance service needs about the caller. Resolved once per
 * request; services never trust a workspace id supplied by the client.
 */
export interface FinanceContext {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  currency: string;
  timezone: string;
  locale: string;
  role: WorkspaceRole;
}

export async function loadFinanceContext(req: Request): Promise<FinanceContext> {
  const { userId } = getAuth(req);

  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { workspace: true, user: true },
  });

  if (!membership) {
    throw new AppError(403, "NO_WORKSPACE", "This account has no workspace membership.");
  }

  return {
    userId,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    currency: membership.workspace.baseCurrency,
    timezone: isValidTimeZone(membership.user.timezone) ? membership.user.timezone : "UTC",
    locale: membership.user.locale,
    role: membership.role,
  };
}
