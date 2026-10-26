import type {
  AnalyticsResponse,
  DashboardResponse,
  MonthlySummaryResponse,
} from "@moneymind/shared";
import { currentMonthInTimeZone, monthRangeUtc, addMonths } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import type { FinanceContext } from "./finance.context.js";
import {
  categoryBreakdown,
  lastMonths,
  monthlyTrend,
  percentChange,
  savingsRate,
  totalsInRange,
} from "./finance.aggregate.js";
import { toTransaction } from "./transactions.service.js";
import { listBudgets } from "./budgets.service.js";
import { listGoals } from "./goals.service.js";

export async function getMonthlySummary(
  ctx: FinanceContext,
  month?: string,
): Promise<MonthlySummaryResponse["data"]> {
  const selected = month ?? currentMonthInTimeZone(ctx.timezone);
  const { start, end } = monthRangeUtc(selected, ctx.timezone);

  const [totals, breakdown] = await Promise.all([
    totalsInRange(ctx.workspaceId, start, end),
    categoryBreakdown(ctx, start, end),
  ]);

  return {
    month: selected,
    currency: ctx.currency,
    totals: {
      incomeMinor: totals.incomeMinor,
      expensesMinor: totals.expensesMinor,
      netMinor: totals.netMinor,
      savingsRate: savingsRate(totals),
      transactionCount: totals.count,
    },
    categoryBreakdown: breakdown,
  };
}

export async function getDashboard(
  ctx: FinanceContext,
  month?: string,
): Promise<DashboardResponse["data"]> {
  const selected = month ?? currentMonthInTimeZone(ctx.timezone);
  const previousMonth = addMonths(selected, -1);

  const selectedRange = monthRangeUtc(selected, ctx.timezone);
  const previousRange = monthRangeUtc(previousMonth, ctx.timezone);

  const [totals, previous, breakdown, trend, recent, budgetsData, activeGoals] = await Promise.all([
    totalsInRange(ctx.workspaceId, selectedRange.start, selectedRange.end),
    totalsInRange(ctx.workspaceId, previousRange.start, previousRange.end),
    categoryBreakdown(ctx, selectedRange.start, selectedRange.end),
    monthlyTrend(ctx, lastMonths(selected, 6)),
    prisma.transaction.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { category: true },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    listBudgets(ctx, selected),
    listGoals(ctx, "ACTIVE"),
  ]);

  return {
    month: selected,
    currency: ctx.currency,
    totals: {
      incomeMinor: totals.incomeMinor,
      expensesMinor: totals.expensesMinor,
      netMinor: totals.netMinor,
      savingsRate: savingsRate(totals),
      transactionCount: totals.count,
    },
    previous: {
      incomeMinor: previous.incomeMinor,
      expensesMinor: previous.expensesMinor,
      netMinor: previous.netMinor,
    },
    changes: {
      incomePercent: percentChange(totals.incomeMinor, previous.incomeMinor),
      expensesPercent: percentChange(totals.expensesMinor, previous.expensesMinor),
    },
    trend,
    categoryBreakdown: breakdown,
    recentTransactions: recent.map(toTransaction),
    budgets: [...budgetsData.budgets]
      .sort((a, b) => b.progressPercent - a.progressPercent)
      .slice(0, 4),
    goals: [...activeGoals].sort((a, b) => b.progressPercent - a.progressPercent).slice(0, 4),
  };
}

export async function getAnalytics(
  ctx: FinanceContext,
  month: string | undefined,
  months: number,
): Promise<AnalyticsResponse["data"]> {
  const selected = month ?? currentMonthInTimeZone(ctx.timezone);
  const { start, end } = monthRangeUtc(selected, ctx.timezone);

  const [totals, breakdown, trend, merchantGroups] = await Promise.all([
    totalsInRange(ctx.workspaceId, start, end),
    categoryBreakdown(ctx, start, end),
    monthlyTrend(ctx, lastMonths(selected, months)),
    prisma.transaction.groupBy({
      by: ["merchant"],
      where: {
        workspaceId: ctx.workspaceId,
        type: "EXPENSE",
        merchant: { not: null },
        occurredAt: { gte: start, lt: end },
      },
      _sum: { amountMinor: true },
      _count: true,
      orderBy: { _sum: { amountMinor: "desc" } },
      take: 5,
    }),
  ]);

  const topMerchants = merchantGroups.flatMap((group) => {
    if (!group.merchant) return [];
    return [
      {
        merchant: group.merchant,
        amountMinor: (group._sum.amountMinor ?? 0n).toString(),
        count: group._count,
      },
    ];
  });

  return {
    month: selected,
    months,
    currency: ctx.currency,
    totals: {
      incomeMinor: totals.incomeMinor,
      expensesMinor: totals.expensesMinor,
      netMinor: totals.netMinor,
      savingsRate: savingsRate(totals),
      transactionCount: totals.count,
    },
    trend,
    categoryBreakdown: breakdown,
    topMerchants,
  };
}
