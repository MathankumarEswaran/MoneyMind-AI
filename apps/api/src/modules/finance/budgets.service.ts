import { Prisma } from "@prisma/client";
import type {
  Budget,
  BudgetStatus,
  BudgetsResponse,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@moneymind/shared";
import { currentMonthInTimeZone, monthRangeUtc } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { toCategoryRef } from "./category.mapper.js";
import { ensureDefaultCategories } from "./default-categories.js";
import type { FinanceContext } from "./finance.context.js";
import { expenseTotalsByCategory } from "./finance.aggregate.js";

const budgetInclude = { category: true } satisfies Prisma.BudgetInclude;

type BudgetRow = Prisma.BudgetGetPayload<{ include: typeof budgetInclude }>;

function toBudget(row: BudgetRow, spentMinor: bigint): Budget {
  const amount = row.amountMinor;
  const progress = Number((spentMinor * 1000n) / amount) / 10;
  const status: BudgetStatus =
    spentMinor > amount ? "OVER" : progress >= 80 ? "NEAR_LIMIT" : "ON_TRACK";

  return {
    id: row.id,
    month: row.month,
    amountMinor: amount.toString(),
    spentMinor: spentMinor.toString(),
    remainingMinor: (amount - spentMinor).toString(),
    progressPercent: progress,
    status,
    category: toCategoryRef(row.category),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listBudgets(
  ctx: FinanceContext,
  month?: string,
): Promise<BudgetsResponse["data"]> {
  const selected = month ?? currentMonthInTimeZone(ctx.timezone);
  await ensureDefaultCategories(ctx.workspaceId);

  const { start, end } = monthRangeUtc(selected, ctx.timezone);
  const [rows, spentByCategory] = await Promise.all([
    prisma.budget.findMany({
      where: { workspaceId: ctx.workspaceId, month: selected },
      include: budgetInclude,
      orderBy: { createdAt: "asc" },
    }),
    expenseTotalsByCategory(ctx.workspaceId, start, end),
  ]);

  const budgets = rows.map((row) => toBudget(row, spentByCategory.get(row.categoryId) ?? 0n));
  const budgeted = budgets.reduce((sum, budget) => sum + BigInt(budget.amountMinor), 0n);
  const spent = budgets.reduce((sum, budget) => sum + BigInt(budget.spentMinor), 0n);

  return {
    month: selected,
    budgets,
    totals: {
      budgetedMinor: budgeted.toString(),
      spentMinor: spent.toString(),
      remainingMinor: (budgeted - spent).toString(),
    },
  };
}

async function findBudget(ctx: FinanceContext, id: string): Promise<BudgetRow> {
  const row = await prisma.budget.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: budgetInclude,
  });

  if (!row) {
    throw new AppError(404, "BUDGET_NOT_FOUND", "That budget does not exist.");
  }

  return row;
}

async function assertExpenseCategory(ctx: FinanceContext, categoryId: string): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, workspaceId: ctx.workspaceId },
    select: { kind: true, name: true },
  });

  if (!category) {
    throw new AppError(422, "CATEGORY_INVALID", "Pick a category from this workspace.");
  }

  if (category.kind !== "EXPENSE") {
    throw new AppError(
      422,
      "CATEGORY_TYPE_MISMATCH",
      `Budgets track spending, so "${category.name}" must be an expense category.`,
    );
  }
}

export async function createBudget(ctx: FinanceContext, input: CreateBudgetInput): Promise<Budget> {
  await ensureDefaultCategories(ctx.workspaceId);
  await assertExpenseCategory(ctx, input.categoryId);

  const month = input.month ?? currentMonthInTimeZone(ctx.timezone);

  try {
    const created = await prisma.budget.create({
      data: {
        workspaceId: ctx.workspaceId,
        categoryId: input.categoryId,
        month,
        amountMinor: BigInt(input.amountMinor),
      },
      include: budgetInclude,
    });

    const { start, end } = monthRangeUtc(month, ctx.timezone);
    const spent = await expenseTotalsByCategory(ctx.workspaceId, start, end);

    return toBudget(created, spent.get(created.categoryId) ?? 0n);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        409,
        "BUDGET_EXISTS",
        "A budget already exists for that category and month.",
      );
    }
    throw error;
  }
}

export async function updateBudget(
  ctx: FinanceContext,
  id: string,
  input: UpdateBudgetInput,
): Promise<Budget> {
  const existing = await findBudget(ctx, id);

  if (input.categoryId !== undefined) {
    await assertExpenseCategory(ctx, input.categoryId);
  }

  try {
    const updated = await prisma.budget.update({
      where: { id: existing.id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.month !== undefined ? { month: input.month } : {}),
        ...(input.amountMinor !== undefined ? { amountMinor: BigInt(input.amountMinor) } : {}),
      },
      include: budgetInclude,
    });

    const { start, end } = monthRangeUtc(updated.month, ctx.timezone);
    const spent = await expenseTotalsByCategory(ctx.workspaceId, start, end);

    return toBudget(updated, spent.get(updated.categoryId) ?? 0n);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        409,
        "BUDGET_EXISTS",
        "A budget already exists for that category and month.",
      );
    }
    throw error;
  }
}

export async function deleteBudget(ctx: FinanceContext, id: string): Promise<void> {
  const result = await prisma.budget.deleteMany({
    where: { id, workspaceId: ctx.workspaceId },
  });

  if (result.count === 0) {
    throw new AppError(404, "BUDGET_NOT_FOUND", "That budget does not exist.");
  }
}

export { toBudget };
