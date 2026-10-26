import type { CategoryBreakdownItem, MonthlyPoint, TransactionTotals } from "@moneymind/shared";
import { monthOf, monthRangeUtc, trailingMonths } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import { toCategoryRef, UNCATEGORIZED } from "./category.mapper.js";
import type { FinanceContext } from "./finance.context.js";

export interface RangeTotals extends TransactionTotals {
  count: number;
}

/** Income, expense and net sums for an arbitrary instant range. */
export async function totalsInRange(
  workspaceId: string,
  start: Date,
  end: Date,
  extraWhere: { type?: "INCOME" | "EXPENSE" } = {},
): Promise<RangeTotals> {
  const [grouped, count] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        workspaceId,
        occurredAt: { gte: start, lt: end },
        ...(extraWhere.type ? { type: extraWhere.type } : {}),
      },
      _sum: { amountMinor: true },
    }),
    prisma.transaction.count({
      where: {
        workspaceId,
        occurredAt: { gte: start, lt: end },
        ...(extraWhere.type ? { type: extraWhere.type } : {}),
      },
    }),
  ]);

  let income = 0n;
  let expenses = 0n;

  for (const group of grouped) {
    const sum = group._sum.amountMinor ?? 0n;
    if (group.type === "INCOME") income += sum;
    else expenses += sum;
  }

  return {
    incomeMinor: income.toString(),
    expensesMinor: expenses.toString(),
    netMinor: (income - expenses).toString(),
    count,
  };
}

/** Expense sums keyed by category id (null for uncategorised rows). */
export async function expenseTotalsByCategory(
  workspaceId: string,
  start: Date,
  end: Date,
): Promise<Map<string | null, bigint>> {
  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      workspaceId,
      type: "EXPENSE",
      occurredAt: { gte: start, lt: end },
    },
    _sum: { amountMinor: true },
  });

  const totals = new Map<string | null, bigint>();

  for (const group of grouped) {
    totals.set(group.categoryId, group._sum.amountMinor ?? 0n);
  }

  return totals;
}

function percentOf(amount: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((amount * 1000n) / total) / 10;
}

/** Spend by category, largest first, with an explicit uncategorised bucket. */
export async function categoryBreakdown(
  ctx: FinanceContext,
  start: Date,
  end: Date,
): Promise<CategoryBreakdownItem[]> {
  const totals = await expenseTotalsByCategory(ctx.workspaceId, start, end);

  const total = [...totals.values()].reduce<bigint>((sum, amount) => sum + amount, 0n);
  if (total === 0n) return [];

  const categoryIds = [...totals.keys()].filter((id): id is string => id !== null);
  const categories = await prisma.category.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: categoryIds } },
    select: { id: true, name: true, kind: true, color: true, icon: true },
  });

  const byId = new Map(categories.map((category) => [category.id, category]));

  return [...totals.entries()]
    .map(([categoryId, amount]): CategoryBreakdownItem => {
      const category = categoryId ? byId.get(categoryId) : undefined;

      return {
        categoryId,
        name: category?.name ?? UNCATEGORIZED.name,
        color: category?.color ?? UNCATEGORIZED.color,
        icon: category?.icon ?? UNCATEGORIZED.icon,
        amountMinor: amount.toString(),
        sharePercent: percentOf(amount, total),
      };
    })
    .filter((item) => BigInt(item.amountMinor) > 0n)
    .sort((a, b) => {
      const delta = BigInt(b.amountMinor) - BigInt(a.amountMinor);
      return delta > 0n ? 1 : delta < 0n ? -1 : a.name.localeCompare(b.name);
    });
}

/** Cash-flow trend for a contiguous list of months, oldest first. */
export async function monthlyTrend(ctx: FinanceContext, months: string[]): Promise<MonthlyPoint[]> {
  const first = months[0];
  const last = months[months.length - 1];

  if (!first || !last) return [];

  const start = monthRangeUtc(first, ctx.timezone).start;
  const end = monthRangeUtc(last, ctx.timezone).end;

  const rows = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      occurredAt: { gte: start, lt: end },
    },
    select: { type: true, amountMinor: true, occurredAt: true },
  });

  const buckets = new Map<string, { income: bigint; expenses: bigint }>();
  for (const month of months) buckets.set(month, { income: 0n, expenses: 0n });

  for (const row of rows) {
    const key = monthOf(row.occurredAt, ctx.timezone);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    if (row.type === "INCOME") bucket.income += row.amountMinor;
    else bucket.expenses += row.amountMinor;
  }

  return months.map((month) => {
    const bucket = buckets.get(month) ?? { income: 0n, expenses: 0n };

    return {
      month,
      incomeMinor: bucket.income.toString(),
      expensesMinor: bucket.expenses.toString(),
      netMinor: (bucket.income - bucket.expenses).toString(),
    };
  });
}

export function savingsRate(totals: TransactionTotals): number | null {
  const income = BigInt(totals.incomeMinor);
  if (income <= 0n) return null;

  return Number((BigInt(totals.netMinor) * 1000n) / income) / 10;
}

export function percentChange(current: string, previous: string): number | null {
  const previousValue = BigInt(previous);
  if (previousValue === 0n) return null;

  const currentValue = BigInt(current);
  return Number(((currentValue - previousValue) * 1000n) / previousValue) / 10;
}

export function lastMonths(endMonth: string, count: number): string[] {
  return trailingMonths(endMonth, count);
}

export { toCategoryRef };
