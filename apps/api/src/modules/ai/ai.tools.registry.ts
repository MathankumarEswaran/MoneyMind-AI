import type { AiContext } from "./ai.context.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { currentMonthInTimeZone, monthRangeUtc } from "@moneymind/shared";
import { qdrantClient } from "../../lib/qdrant/client.js";
import { getEmbeddingProvider } from "../../lib/embeddings/factory.js";
import { env } from "../../config/env.js";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresConfirmation: boolean;
  isDestructive: boolean;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_account_summary",
    description: "Get workspace account summary including totals for current month.",
    parameters: { type: "object", properties: {}, required: [] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "get_recent_transactions",
    description: "Get recent transactions (up to 20).",
    parameters: { type: "object", properties: { limit: { type: "number" } }, required: [] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "search_transactions",
    description: "Search transactions by description or merchant.",
    parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "get_monthly_spending",
    description: "Get monthly spending summary for a given month (YYYY-MM).",
    parameters: { type: "object", properties: { month: { type: "string" } }, required: [] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "get_category_spending",
    description: "Get spending breakdown by category for current month.",
    parameters: { type: "object", properties: {}, required: [] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "check_budget_status",
    description: "Check budget status for current month.",
    parameters: { type: "object", properties: {}, required: [] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "check_financial_goals",
    description: "Check progress on financial goals.",
    parameters: { type: "object", properties: {}, required: [] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "search_uploaded_documents",
    description: "Search uploaded documents using semantic search.",
    parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
    requiresConfirmation: false,
    isDestructive: false,
  },
  {
    name: "generate_spending_summary",
    description: "Generate a comprehensive spending summary.",
    parameters: { type: "object", properties: { months: { type: "number" } }, required: [] },
    requiresConfirmation: false,
    isDestructive: false,
  },
];

export async function executeTool(ctx: AiContext, name: string, args: Record<string, unknown>): Promise<unknown> {
  const month = currentMonthInTimeZone(ctx.timezone);
  const { start, end } = monthRangeUtc(month, ctx.timezone);

  switch (name) {
    case "get_account_summary": {
      const [income, expense] = await Promise.all([
        prisma.transaction.aggregate({
          where: { workspaceId: ctx.workspaceId, type: "INCOME", occurredAt: { gte: start, lt: end } },
          _sum: { amountMinor: true },
        }),
        prisma.transaction.aggregate({
          where: { workspaceId: ctx.workspaceId, type: "EXPENSE", occurredAt: { gte: start, lt: end } },
          _sum: { amountMinor: true },
        }),
      ]);
      return {
        month,
        currency: ctx.currency,
        incomeMinor: (income._sum.amountMinor || 0n).toString(),
        expenseMinor: (expense._sum.amountMinor || 0n).toString(),
        netMinor: ((income._sum.amountMinor || 0n) - (expense._sum.amountMinor || 0n)).toString(),
      };
    }
    case "get_recent_transactions": {
      const limit = typeof args.limit === "number" ? Math.min(args.limit, 20) : 10;
      const txs = await prisma.transaction.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { occurredAt: "desc" },
        take: limit,
        include: { category: true },
      });
      return txs.map((t) => ({
        id: t.id,
        type: t.type,
        amountMinor: t.amountMinor.toString(),
        description: t.description,
        merchant: t.merchant,
        occurredAt: t.occurredAt.toISOString(),
        category: t.category?.name,
      }));
    }
    case "search_transactions": {
      const query = String(args.query || "");
      const limit = typeof args.limit === "number" ? Math.min(args.limit, 20) : 10;
      const txs = await prisma.transaction.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          OR: [
            { description: { contains: query, mode: "insensitive" } },
            { merchant: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { occurredAt: "desc" },
        take: limit,
        include: { category: true },
      });
      return txs.map((t) => ({
        id: t.id,
        type: t.type,
        amountMinor: t.amountMinor.toString(),
        description: t.description,
        merchant: t.merchant,
        occurredAt: t.occurredAt.toISOString(),
        category: t.category?.name,
      }));
    }
    case "get_monthly_spending": {
      const m = typeof args.month === "string" ? args.month : month;
      const { start: s, end: e } = monthRangeUtc(m, ctx.timezone);
      const [income, expense] = await Promise.all([
        prisma.transaction.aggregate({
          where: { workspaceId: ctx.workspaceId, type: "INCOME", occurredAt: { gte: s, lt: e } },
          _sum: { amountMinor: true },
        }),
        prisma.transaction.aggregate({
          where: { workspaceId: ctx.workspaceId, type: "EXPENSE", occurredAt: { gte: s, lt: e } },
          _sum: { amountMinor: true },
        }),
      ]);
      return { month: m, incomeMinor: (income._sum.amountMinor || 0n).toString(), expenseMinor: (expense._sum.amountMinor || 0n).toString(), netMinor: ((income._sum.amountMinor || 0n) - (expense._sum.amountMinor || 0n)).toString() };
    }
    case "get_category_spending": {
      const txs = await prisma.transaction.findMany({
        where: { workspaceId: ctx.workspaceId, type: "EXPENSE", occurredAt: { gte: start, lt: end } },
        include: { category: true },
      });
      const map = new Map<string, bigint>();
      for (const t of txs) {
        const key = t.category?.name || "Uncategorized";
        map.set(key, (map.get(key) || 0n) + t.amountMinor);
      }
      return Array.from(map.entries()).map(([category, amountMinor]) => ({ category, amountMinor: amountMinor.toString() }));
    }
    case "check_budget_status": {
      const budgets = await prisma.budget.findMany({
        where: { workspaceId: ctx.workspaceId, month },
        include: { category: true },
      });
      const results = [];
      for (const b of budgets) {
        const spent = await prisma.transaction.aggregate({
          where: { workspaceId: ctx.workspaceId, type: "EXPENSE", categoryId: b.categoryId, occurredAt: { gte: start, lt: end } },
          _sum: { amountMinor: true },
        });
        const s = spent._sum.amountMinor || 0n;
        results.push({
          category: b.category.name,
          budgetMinor: b.amountMinor.toString(),
          spentMinor: s.toString(),
          percentUsed: b.amountMinor > 0n ? Number(s) / Number(b.amountMinor) : 0,
        });
      }
      return results;
    }
    case "check_financial_goals": {
      const goals = await prisma.goal.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { contributions: true },
      });
      return goals.map((g) => {
        const saved = g.contributions.reduce((acc, c) => acc + c.amountMinor, 0n);
        return {
          name: g.name,
          status: g.status,
          targetMinor: g.targetAmountMinor.toString(),
          savedMinor: saved.toString(),
          percentComplete: g.targetAmountMinor > 0n ? Number(saved) / Number(g.targetAmountMinor) : 0,
        };
      });
    }
    case "search_uploaded_documents": {
      const query = String(args.query || "");
      const limit = typeof args.limit === "number" ? Math.min(args.limit, 10) : 5;
      await qdrantClient.ensureCollection(env.embeddings.dimensions);
      const embedder = getEmbeddingProvider();
      const [vec] = await embedder.embed([query]);
      const results = await qdrantClient.search({
        vector: vec,
        limit,
        filter: {
          must: [
            { key: "userId", match: { value: ctx.userId } },
            { key: "workspaceId", match: { value: ctx.workspaceId } },
          ],
        },
      });
      return results.map((r) => ({
        documentId: r.payload.documentId,
        filename: r.payload.filename,
        chunkIndex: r.payload.chunkIndex,
        score: r.score,
        excerpt: String(r.payload.text || "").slice(0, 200),
      }));
    }
    case "generate_spending_summary": {
      const monthsCount = typeof args.months === "number" ? Math.min(args.months, 6) : 3;
      const summaries = [];
      for (let i = 0; i < monthsCount; i++) {
        const m = new Date();
        const target = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - i, 1));
        const monthStr = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
        const { start: s, end: e } = monthRangeUtc(monthStr, ctx.timezone);
        const [income, expense] = await Promise.all([
          prisma.transaction.aggregate({
            where: { workspaceId: ctx.workspaceId, type: "INCOME", occurredAt: { gte: s, lt: e } },
            _sum: { amountMinor: true },
          }),
          prisma.transaction.aggregate({
            where: { workspaceId: ctx.workspaceId, type: "EXPENSE", occurredAt: { gte: s, lt: e } },
            _sum: { amountMinor: true },
          }),
        ]);
        summaries.push({
          month: monthStr,
          incomeMinor: (income._sum.amountMinor || 0n).toString(),
          expenseMinor: (expense._sum.amountMinor || 0n).toString(),
          netMinor: ((income._sum.amountMinor || 0n) - (expense._sum.amountMinor || 0n)).toString(),
        });
      }
      return summaries;
    }
    default:
      throw new AppError(400, "UNKNOWN_TOOL", "Unknown tool.");
  }
}
