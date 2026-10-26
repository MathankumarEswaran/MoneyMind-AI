import { Prisma } from "@prisma/client";
import type {
  Category,
  CategoriesQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { toCategory } from "./category.mapper.js";
import { ensureDefaultCategories } from "./default-categories.js";
import type { FinanceContext } from "./finance.context.js";

const categoryInclude = {
  _count: { select: { transactions: true } },
} satisfies Prisma.CategoryInclude;

export async function listCategories(
  ctx: FinanceContext,
  query: CategoriesQuery,
): Promise<Category[]> {
  await ensureDefaultCategories(ctx.workspaceId);

  const categories = await prisma.category.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(query.kind ? { kind: query.kind } : {}),
    },
    include: categoryInclude,
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return categories.map(toCategory);
}

async function assertNameAvailable(
  workspaceId: string,
  kind: "INCOME" | "EXPENSE",
  name: string,
  excludeId?: string,
): Promise<void> {
  const duplicate = await prisma.category.findFirst({
    where: {
      workspaceId,
      kind,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(
      409,
      "CATEGORY_EXISTS",
      `A ${kind.toLowerCase()} category named "${name}" already exists.`,
    );
  }
}

export async function createCategory(
  ctx: FinanceContext,
  input: CreateCategoryInput,
): Promise<Category> {
  await ensureDefaultCategories(ctx.workspaceId);
  await assertNameAvailable(ctx.workspaceId, input.kind, input.name);

  try {
    const created = await prisma.category.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: input.name,
        kind: input.kind,
        color: input.color ?? null,
        icon: input.icon ?? null,
        isSystem: false,
        sortOrder: 200,
      },
      include: categoryInclude,
    });

    return toCategory(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "CATEGORY_EXISTS", "A category with that name already exists.");
    }
    throw error;
  }
}

async function findCategory(ctx: FinanceContext, id: string) {
  const category = await prisma.category.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: categoryInclude,
  });

  if (!category) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "That category does not exist.");
  }

  return category;
}

export async function updateCategory(
  ctx: FinanceContext,
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const existing = await findCategory(ctx, id);

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameAvailable(ctx.workspaceId, existing.kind, input.name, id);
  }

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
    },
    include: categoryInclude,
  });

  return toCategory(updated);
}

export async function deleteCategory(ctx: FinanceContext, id: string): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { _count: { select: { transactions: true, budgets: true } } },
  });

  if (!category) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "That category does not exist.");
  }

  if (category.isSystem) {
    throw new AppError(
      409,
      "CATEGORY_SYSTEM",
      "Starter categories can be renamed but not deleted.",
    );
  }

  if (category._count.transactions > 0 || category._count.budgets > 0) {
    throw new AppError(
      409,
      "CATEGORY_IN_USE",
      "Move or delete this category's transactions and budgets first.",
      {
        details: {
          transactions: category._count.transactions,
          budgets: category._count.budgets,
        },
      },
    );
  }

  await prisma.category.delete({ where: { id: category.id } });
}
