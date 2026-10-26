import type { Prisma } from "@prisma/client";
import type {
  CreateTransactionInput,
  Transaction,
  TransactionListMeta,
  TransactionListQuery,
  TransactionTotals,
  UpdateTransactionInput,
} from "@moneymind/shared";
import { addDays, dayStartUtc } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { toCategoryRef } from "./category.mapper.js";
import type { FinanceContext } from "./finance.context.js";

const transactionInclude = {
  category: true,
} satisfies Prisma.TransactionInclude;

type TransactionRow = Prisma.TransactionGetPayload<{ include: typeof transactionInclude }>;

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amountMinor.toString(),
    currency: row.currency,
    description: row.description,
    merchant: row.merchant,
    notes: row.notes,
    occurredAt: row.occurredAt.toISOString(),
    category: row.category ? toCategoryRef(row.category) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(
  ctx: FinanceContext,
  query: TransactionListQuery,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { workspaceId: ctx.workspaceId };

  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;

  if (query.q) {
    where.OR = [
      { description: { contains: query.q, mode: "insensitive" } },
      { merchant: { contains: query.q, mode: "insensitive" } },
      { notes: { contains: query.q, mode: "insensitive" } },
      { category: { is: { name: { contains: query.q, mode: "insensitive" } } } },
    ];
  }

  if (query.from || query.to) {
    where.occurredAt = {
      ...(query.from ? { gte: dayStartUtc(query.from, ctx.timezone) } : {}),
      ...(query.to ? { lt: dayStartUtc(addDays(query.to, 1), ctx.timezone) } : {}),
    };
  }

  return where;
}

export async function listTransactions(
  ctx: FinanceContext,
  query: TransactionListQuery,
): Promise<{ transactions: Transaction[]; meta: TransactionListMeta }> {
  const where = buildWhere(ctx, query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total, grouped] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ occurredAt: query.order }, { createdAt: query.order }],
      skip,
      take: query.limit,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amountMinor: true },
    }),
  ]);

  let income = 0n;
  let expenses = 0n;

  for (const group of grouped) {
    const sum = group._sum.amountMinor ?? 0n;
    if (group.type === "INCOME") income += sum;
    else expenses += sum;
  }

  const totals: TransactionTotals = {
    incomeMinor: income.toString(),
    expensesMinor: expenses.toString(),
    netMinor: (income - expenses).toString(),
  };

  return {
    transactions: rows.map(toTransaction),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      totals,
    },
  };
}

async function findTransaction(ctx: FinanceContext, id: string): Promise<TransactionRow> {
  const row = await prisma.transaction.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: transactionInclude,
  });

  if (!row) {
    throw new AppError(404, "TRANSACTION_NOT_FOUND", "That transaction does not exist.");
  }

  return row;
}

export async function getTransaction(ctx: FinanceContext, id: string): Promise<Transaction> {
  return toTransaction(await findTransaction(ctx, id));
}

async function resolveCategory(
  ctx: FinanceContext,
  categoryId: string | null | undefined,
  type: "INCOME" | "EXPENSE",
): Promise<string | null> {
  if (categoryId === undefined || categoryId === null) return null;

  const category = await prisma.category.findFirst({
    where: { id: categoryId, workspaceId: ctx.workspaceId },
    select: { id: true, kind: true, name: true },
  });

  if (!category) {
    throw new AppError(422, "CATEGORY_INVALID", "Pick a category from this workspace.");
  }

  if (category.kind !== type) {
    throw new AppError(
      422,
      "CATEGORY_TYPE_MISMATCH",
      `"${category.name}" is a ${category.kind.toLowerCase()} category, not ${type.toLowerCase()}.`,
    );
  }

  return category.id;
}

export async function createTransaction(
  ctx: FinanceContext,
  input: CreateTransactionInput,
): Promise<Transaction> {
  const categoryId = await resolveCategory(ctx, input.categoryId, input.type);

  const created = await prisma.transaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      type: input.type,
      amountMinor: BigInt(input.amountMinor),
      currency: ctx.currency,
      description: input.description,
      merchant: input.merchant ?? null,
      notes: input.notes ?? null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      categoryId,
    },
    include: transactionInclude,
  });

  return toTransaction(created);
}

export async function updateTransaction(
  ctx: FinanceContext,
  id: string,
  input: UpdateTransactionInput,
): Promise<Transaction> {
  const existing = await findTransaction(ctx, id);
  const type = input.type ?? existing.type;

  let categoryId: string | null | undefined;
  if (input.categoryId !== undefined) {
    categoryId = await resolveCategory(ctx, input.categoryId, type);
  } else if (input.type && existing.categoryId && existing.category?.kind !== input.type) {
    throw new AppError(
      422,
      "CATEGORY_TYPE_MISMATCH",
      "Pick a category that matches the new transaction type.",
    );
  }

  const updated = await prisma.transaction.update({
    where: { id: existing.id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.amountMinor !== undefined ? { amountMinor: BigInt(input.amountMinor) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.occurredAt !== undefined ? { occurredAt: new Date(input.occurredAt) } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
    },
    include: transactionInclude,
  });

  return toTransaction(updated);
}

export async function deleteTransaction(ctx: FinanceContext, id: string): Promise<void> {
  const result = await prisma.transaction.deleteMany({
    where: { id, workspaceId: ctx.workspaceId },
  });

  if (result.count === 0) {
    throw new AppError(404, "TRANSACTION_NOT_FOUND", "That transaction does not exist.");
  }
}
