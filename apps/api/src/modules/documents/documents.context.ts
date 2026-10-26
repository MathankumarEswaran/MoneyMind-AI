import type { Request } from "express";
import { getAuth } from "../../middleware/authenticate.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";

export interface DocumentContext {
  userId: string;
  sessionId: string;
  workspaceId: string;
}

export async function loadDocumentContext(req: Request): Promise<DocumentContext> {
  const auth = getAuth(req);
  const membership = await prisma.membership.findFirst({
    where: { userId: auth.userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  if (!membership) {
    throw new AppError(403, "NO_WORKSPACE", "No workspace is associated with this account.");
  }
  return { userId: auth.userId, sessionId: auth.sessionId, workspaceId: membership.workspaceId };
}
