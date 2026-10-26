import { prisma } from "../../db/prisma.js";
import { DEFAULT_CATEGORIES } from "./category.mapper.js";

/**
 * Seed the starter set the first time a workspace opens the finance area.
 * Seeding is skipped once *any* category exists so a renamed or deleted
 * default is never resurrected.
 */
export async function ensureDefaultCategories(workspaceId: string): Promise<void> {
  const existing = await prisma.category.count({ where: { workspaceId } });
  if (existing > 0) return;

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({
      workspaceId,
      ...category,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
}
