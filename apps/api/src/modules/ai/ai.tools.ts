import { addMonths, currentMonthInTimeZone } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import type { AiContext } from "./ai.context.js";

const FINANCIAL_KEYWORDS = [
  "spend",
  "spending",
  "expense",
  "expenses",
  "income",
  "budget",
  "budgets",
  "goal",
  "goals",
  "transaction",
  "transactions",
  "balance",
  "savings",
  "save",
  "money",
  "cash",
  "bill",
  "merchant",
  "category",
  "month",
  "trend",
  "unusual",
  "overspend",
  "afford",
];

export function isFinancialQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return FINANCIAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export async function buildFinancialContext(ctx: AiContext): Promise<string> {
  const month = currentMonthInTimeZone(ctx.timezone);
  const lastMonth = addMonths(month, -1);

  const [monthStart, monthEnd] = getMonthBounds(month, ctx.timezone);
  const [lastStart, lastEnd] = getMonthBounds(lastMonth, ctx.timezone);

  const [monthTx, lastTx, budgets, goals, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: { workspaceId: ctx.workspaceId, occurredAt: { gte: monthStart, lt: monthEnd } },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: { workspaceId: ctx.workspaceId, occurredAt: { gte: lastStart, lt: lastEnd } },
      include: { category: true },
    }),
    prisma.budget.findMany({
      where: { workspaceId: ctx.workspaceId, month },
      include: { category: true },
    }),
    prisma.goal.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { contributions: true },
    }),
    prisma.category.findMany({
      where: { workspaceId: ctx.workspaceId },
    }),
  ]);

  const sum = (txs: typeof monthTx, type: "INCOME" | "EXPENSE") =>
    txs
      .filter((t) => t.type === type)
      .reduce((acc, t) => acc + t.amountMinor, 0n);

  const monthIncome = sum(monthTx, "INCOME");
  const monthExpense = sum(monthTx, "EXPENSE");
  const lastIncome = sum(lastTx, "INCOME");
  const lastExpense = sum(lastTx, "EXPENSE");

  const fmt = (n: bigint) => `$${(Number(n) / 100).toFixed(2)}`;

  const categorySpend = monthTx
    .filter((t) => t.type === "EXPENSE" && t.category)
    .reduce(
      (acc, t) => {
        const key = t.category!.name;
        acc[key] = (acc[key] || 0n) + t.amountMinor;
        return acc;
      },
      {} as Record<string, bigint>,
    );

  const topCategories = Object.entries(categorySpend)
    .sort((a, b) => (a[1] > b[1] ? -1 : 1))
    .slice(0, 5)
    .map(([name, amt]) => `  - ${name}: ${fmt(amt)}`)
    .join("\n");

  const budgetLines = budgets
    .map((b) => {
      const spent = monthTx
        .filter((t) => t.type === "EXPENSE" && t.categoryId === b.categoryId)
        .reduce((acc, t) => acc + t.amountMinor, 0n);
      const budgetAmt = b.amountMinor;
      const pct = budgetAmt > 0n ? (Number(spent) / Number(budgetAmt)) * 100 : 0;
      return `  - ${b.category.name}: spent ${fmt(spent)} / budget ${fmt(budgetAmt)} (${pct.toFixed(1)}%)`;
    })
    .join("\n");

  const goalLines = goals
    .map((g) => {
      const saved = g.contributions.reduce((acc, c) => acc + c.amountMinor, 0n);
      const pct = g.targetAmountMinor > 0n ? (Number(saved) / Number(g.targetAmountMinor)) * 100 : 0;
      return `  - ${g.name} (${g.status}): saved ${fmt(saved)} / target ${fmt(g.targetAmountMinor)} (${pct.toFixed(1)}%)`;
    })
    .join("\n");

  return [
    `Workspace context (currency: ${ctx.currency}, timezone: ${ctx.timezone}):`,
    `Current month (${month}): ${monthTx.length} transactions, income ${fmt(monthIncome)}, expenses ${fmt(monthExpense)}, net ${fmt(monthIncome - monthExpense)}`,
    `Previous month (${lastMonth}): income ${fmt(lastIncome)}, expenses ${fmt(lastExpense)}, net ${fmt(lastIncome - lastExpense)}`,
    `Categories: ${categories.length} total`,
    `Top spending categories (current month):`,
    topCategories || "  - None",
    `Budgets (${budgets.length}):`,
    budgetLines || "  - None",
    `Goals (${goals.length}):`,
    goalLines || "  - None",
  ].join("\n");
}

function getMonthBounds(month: string, _timezone: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return [start, end];
}

export function buildSystemPrompt(_ctx: AiContext, contextText: string, isFinancial: boolean): string {
  const base = `You are MoneyMind AI, a helpful financial assistant for a personal finance workspace.
You must follow these rules strictly:
- All financial amounts in this application are represented in Indian Rupees (INR).
- Always use ₹ when presenting monetary values.
- Use Indian number formatting such as ₹1,00,000.
- Never return USD, $, EUR, GBP, or other foreign currencies unless explicitly requested by the user.
- Only use data from the authenticated user's workspace. Never guess or fabricate numbers.
- You are ANALYZING data, not providing guaranteed or authoritative financial advice.
- Clearly distinguish between analysis (facts from data) and suggestions/recommendations.
- When giving recommendations, say "suggestion" and include a disclaimer.
- Never expose API keys, secrets, or internal implementation details.
- Be specific with numbers when available from context.
- Keep responses concise and actionable.

${contextText}`;

  if (isFinancial) {
    return `${base}

Focus on: explaining spending patterns, summarizing monthly finances, answering about transactions, suggesting budgeting improvements, identifying unusual spending, explaining budget performance, and providing actionable financial insights.
Always end with a note that this is analysis and suggestions, not guaranteed financial advice.`;
  }

  return base;
}

export function generateSuggestions(isFinancial: boolean): string[] {
  if (isFinancial) {
    return [
      "What are my top spending categories this month?",
      "How am I doing compared to last month?",
      "Which budgets are at risk of being exceeded?",
      "What can I do to improve my savings rate?",
    ];
  }
  return [
    "Summarize my finances this month",
    "Which budget needs attention?",
    "What's my progress toward my goals?",
    "Are there any unusual spending patterns?",
  ];
}
