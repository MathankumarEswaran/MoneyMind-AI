import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import type { Response } from "supertest";
import {
  AnalyticsResponseSchema,
  AuthResponseSchema,
  BudgetsResponseSchema,
  CategoriesResponseSchema,
  DashboardResponseSchema,
  GoalsResponseSchema,
  GoalContributionResponseSchema,
  GoalContributionsResponseSchema,
  MonthlySummaryResponseSchema,
  TransactionResponseSchema,
  TransactionsResponseSchema,
} from "@moneymind/shared";
import { createApp } from "../app.js";

const app = createApp();
const PASSWORD = "correct horse battery staple";

function uniqueEmail(prefix = "finance"): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

async function register(workspaceName = "Finance Test Household") {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Grace Hopper",
      email: uniqueEmail(),
      password: PASSWORD,
      workspaceName,
    })
    .expect(201);

  expect(AuthResponseSchema.safeParse(response.body).success).toBe(true);

  return response.body.data as {
    accessToken: string;
    user: { id: string; workspace: { id: string; baseCurrency: string } };
  };
}

function get(path: string, token: string): request.Test {
  return request(app).get(path).set("authorization", `Bearer ${token}`);
}

function post(path: string, token: string, body?: unknown): request.Test {
  const test = request(app).post(path).set("authorization", `Bearer ${token}`);
  return body === undefined ? test : test.send(body);
}

function patch(path: string, token: string, body: unknown): request.Test {
  return request(app).patch(path).set("authorization", `Bearer ${token}`).send(body);
}

function del(path: string, token: string): request.Test {
  return request(app).delete(path).set("authorization", `Bearer ${token}`);
}

async function categories(token: string) {
  const response = await get("/api/v1/finance/categories", token).expect(200);
  const parsed = CategoriesResponseSchema.safeParse(response.body);
  expect(parsed.success).toBe(true);
  return response.body.data.categories as Array<{
    id: string;
    name: string;
    kind: "INCOME" | "EXPENSE";
    isSystem: boolean;
  }>;
}

async function categoryId(token: string, name: string): Promise<string> {
  const list = await categories(token);
  const found = list.find((category) => category.name === name);
  if (!found) throw new Error(`Category "${name}" was not seeded`);
  return found.id;
}

async function createTransaction(token: string, input: Record<string, unknown>): Promise<Response> {
  return post("/api/v1/finance/transactions", token, input).expect(201);
}

describe("finance authentication", () => {
  it("rejects anonymous calls", async () => {
    const response = await request(app).get("/api/v1/finance/dashboard").expect(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejects a revoked session even while the access token is valid", async () => {
    const session = await register();

    const me = await get("/api/v1/auth/me", session.accessToken).expect(200);
    const sessionId = me.body.data.session.id as string;

    await get("/api/v1/finance/dashboard", session.accessToken).expect(200);

    await del(`/api/v1/auth/sessions/${sessionId}`, session.accessToken).expect(200);

    const response = await get("/api/v1/finance/dashboard", session.accessToken).expect(401);
    expect(response.body.error.code).toBe("SESSION_REVOKED");
  });
});

describe("categories", () => {
  it("seeds the starter set once and lists both kinds", async () => {
    const { accessToken } = await register();
    const list = await categories(accessToken);

    expect(list.filter((category) => category.kind === "INCOME")).toHaveLength(4);
    expect(list.filter((category) => category.kind === "EXPENSE")).toHaveLength(12);
    expect(list.every((category) => category.isSystem)).toBe(true);
    expect(list.some((category) => category.name === "Groceries")).toBe(true);

    const again = await categories(accessToken);
    expect(again).toHaveLength(list.length);
  });

  it("creates, renames and deletes a custom category", async () => {
    const { accessToken } = await register();

    const created = await post("/api/v1/finance/categories", accessToken, {
      name: "Pets",
      kind: "EXPENSE",
      color: "#10B981",
      icon: "paw-print",
    }).expect(201);

    expect(created.body.data.category).toMatchObject({
      name: "Pets",
      kind: "EXPENSE",
      color: "#10b981",
      isSystem: false,
      transactionCount: 0,
    });

    const id = created.body.data.category.id as string;

    const updated = await patch(`/api/v1/finance/categories/${id}`, accessToken, {
      name: "Pet Care",
    }).expect(200);
    expect(updated.body.data.category.name).toBe("Pet Care");

    await del(`/api/v1/finance/categories/${id}`, accessToken).expect(200);

    const list = await categories(accessToken);
    expect(list.some((category) => category.id === id)).toBe(false);
  });

  it("rejects duplicate names case-insensitively", async () => {
    const { accessToken } = await register();
    await post("/api/v1/finance/categories", accessToken, {
      name: "Pets",
      kind: "EXPENSE",
    }).expect(201);

    const response = await post("/api/v1/finance/categories", accessToken, {
      name: "pets",
      kind: "EXPENSE",
    }).expect(409);

    expect(response.body.error.code).toBe("CATEGORY_EXISTS");
  });

  it("protects system categories and categories with history", async () => {
    const { accessToken } = await register();
    const groceries = await categoryId(accessToken, "Groceries");

    const system = await del(`/api/v1/finance/categories/${groceries}`, accessToken).expect(409);
    expect(system.body.error.code).toBe("CATEGORY_SYSTEM");

    const custom = await post("/api/v1/finance/categories", accessToken, {
      name: "Hobbies",
      kind: "EXPENSE",
    }).expect(201);

    const customId = custom.body.data.category.id as string;
    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "5000",
      description: "Model kit",
      categoryId: customId,
      occurredAt: "2026-03-12T10:00:00.000Z",
    });

    const inUse = await del(`/api/v1/finance/categories/${customId}`, accessToken).expect(409);
    expect(inUse.body.error.code).toBe("CATEGORY_IN_USE");
    expect(inUse.body.error.details.transactions).toBe(1);
  });
});

describe("transactions", () => {
  it("creates, reads, updates and deletes a transaction", async () => {
    const { accessToken } = await register();
    const groceries = await categoryId(accessToken, "Groceries");

    const created = await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "12345",
      description: "Weekly shop",
      merchant: "Whole Foods",
      notes: "Includes household items",
      categoryId: groceries,
      occurredAt: "2026-03-05T10:00:00.000Z",
    });

    const parsed = TransactionResponseSchema.safeParse(created.body);
    expect(parsed.success).toBe(true);

    const transaction = created.body.data.transaction as {
      id: string;
      amountMinor: string;
      currency: string;
      category: { id: string } | null;
    };

    expect(transaction.amountMinor).toBe("12345");
    expect(transaction.currency).toBe("INR");
    expect(transaction.category?.id).toBe(groceries);

    const fetched = await get(`/api/v1/finance/transactions/${transaction.id}`, accessToken).expect(
      200,
    );
    expect(fetched.body.data.transaction.description).toBe("Weekly shop");

    const updated = await patch(`/api/v1/finance/transactions/${transaction.id}`, accessToken, {
      amountMinor: "20000",
      merchant: null,
    }).expect(200);
    expect(updated.body.data.transaction.amountMinor).toBe("20000");
    expect(updated.body.data.transaction.merchant).toBeNull();

    await del(`/api/v1/finance/transactions/${transaction.id}`, accessToken).expect(200);
    await get(`/api/v1/finance/transactions/${transaction.id}`, accessToken).expect(404);
  });

  it("validates money, unknown fields and category/type mismatches", async () => {
    const { accessToken } = await register();
    const salary = await categoryId(accessToken, "Salary");

    const zero = await post("/api/v1/finance/transactions", accessToken, {
      type: "EXPENSE",
      amountMinor: "0",
      description: "Nothing",
    }).expect(422);
    expect(zero.body.error.code).toBe("VALIDATION_ERROR");

    const negative = await post("/api/v1/finance/transactions", accessToken, {
      type: "EXPENSE",
      amountMinor: "-100",
      description: "Negative",
    }).expect(422);
    expect(negative.body.error.details.fields.amountMinor).toBeDefined();

    const unknown = await post("/api/v1/finance/transactions", accessToken, {
      type: "EXPENSE",
      amountMinor: "100",
      description: "Extra field",
      workspaceId: "00000000-0000-0000-0000-000000000000",
    }).expect(422);
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR");

    const mismatch = await post("/api/v1/finance/transactions", accessToken, {
      type: "EXPENSE",
      amountMinor: "100",
      description: "Wrong category kind",
      categoryId: salary,
    }).expect(422);
    expect(mismatch.body.error.code).toBe("CATEGORY_TYPE_MISMATCH");
  });

  it("filters by search, type, category, date range and paginates with totals", async () => {
    const { accessToken } = await register();
    const salary = await categoryId(accessToken, "Salary");
    const groceries = await categoryId(accessToken, "Groceries");
    const dining = await categoryId(accessToken, "Dining");
    const freelance = await categoryId(accessToken, "Freelance");

    await createTransaction(accessToken, {
      type: "INCOME",
      amountMinor: "500000",
      description: "March salary",
      categoryId: salary,
      occurredAt: "2026-03-01T10:00:00.000Z",
    });
    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "120000",
      description: "Weekly shop",
      merchant: "Whole Foods",
      categoryId: groceries,
      occurredAt: "2026-03-05T10:00:00.000Z",
    });
    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "30000",
      description: "Dinner out",
      categoryId: dining,
      occurredAt: "2026-03-10T19:00:00.000Z",
    });
    await createTransaction(accessToken, {
      type: "INCOME",
      amountMinor: "100000",
      description: "Side project",
      categoryId: freelance,
      occurredAt: "2026-03-15T10:00:00.000Z",
    });
    // Previous month, must not leak into March ranges.
    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "50000",
      description: "February shop",
      categoryId: groceries,
      occurredAt: "2026-02-10T10:00:00.000Z",
    });

    const all = await get(
      "/api/v1/finance/transactions?from=2026-03-01&to=2026-03-31",
      accessToken,
    ).expect(200);

    expect(TransactionsResponseSchema.safeParse(all.body).success).toBe(true);
    expect(all.body.data.transactions).toHaveLength(4);
    expect(all.body.meta.total).toBe(4);
    expect(all.body.meta.totals).toEqual({
      incomeMinor: "600000",
      expensesMinor: "150000",
      netMinor: "450000",
    });

    const expensesOnly = await get(
      "/api/v1/finance/transactions?from=2026-03-01&to=2026-03-31&type=EXPENSE",
      accessToken,
    ).expect(200);
    expect(expensesOnly.body.data.transactions).toHaveLength(2);

    const byCategory = await get(
      `/api/v1/finance/transactions?categoryId=${groceries}&from=2026-03-01&to=2026-03-31`,
      accessToken,
    ).expect(200);
    expect(byCategory.body.data.transactions).toHaveLength(1);

    const byMerchant = await get("/api/v1/finance/transactions?q=whole", accessToken).expect(200);
    expect(byMerchant.body.data.transactions).toHaveLength(1);

    const byCategoryName = await get("/api/v1/finance/transactions?q=dining", accessToken).expect(
      200,
    );
    expect(byCategoryName.body.data.transactions).toHaveLength(1);
    expect(byCategoryName.body.data.transactions[0].description).toBe("Dinner out");

    const dateFiltered = await get(
      "/api/v1/finance/transactions?from=2026-03-06&to=2026-03-31",
      accessToken,
    ).expect(200);
    expect(dateFiltered.body.data.transactions).toHaveLength(2);

    const page = await get(
      "/api/v1/finance/transactions?from=2026-03-01&to=2026-03-31&limit=2&page=2&order=asc",
      accessToken,
    ).expect(200);
    expect(page.body.data.transactions).toHaveLength(2);
    expect(page.body.meta).toMatchObject({ page: 2, limit: 2, total: 4, totalPages: 2 });
  });

  it("rejects an inverted date range", async () => {
    const { accessToken } = await register();

    const response = await get(
      "/api/v1/finance/transactions?from=2026-03-31&to=2026-03-01",
      accessToken,
    ).expect(422);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns an empty page instead of failing when nothing matches", async () => {
    const { accessToken } = await register();

    const response = await get("/api/v1/finance/transactions", accessToken).expect(200);
    expect(response.body.data.transactions).toEqual([]);
    expect(response.body.meta).toMatchObject({
      page: 1,
      total: 0,
      totalPages: 0,
      totals: { incomeMinor: "0", expensesMinor: "0", netMinor: "0" },
    });
  });
});

describe("monthly summary and analytics", () => {
  it("reports totals, savings rate and a category breakdown", async () => {
    const { accessToken } = await register();
    const salary = await categoryId(accessToken, "Salary");
    const groceries = await categoryId(accessToken, "Groceries");
    const dining = await categoryId(accessToken, "Dining");

    await createTransaction(accessToken, {
      type: "INCOME",
      amountMinor: "500000",
      description: "Salary",
      categoryId: salary,
      occurredAt: "2026-03-01T10:00:00.000Z",
    });
    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "120000",
      description: "Groceries",
      categoryId: groceries,
      occurredAt: "2026-03-05T10:00:00.000Z",
    });
    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "30000",
      description: "Dining",
      categoryId: dining,
      occurredAt: "2026-03-06T10:00:00.000Z",
    });

    const response = await get("/api/v1/finance/summary?month=2026-03", accessToken).expect(200);
    expect(MonthlySummaryResponseSchema.safeParse(response.body).success).toBe(true);

    expect(response.body.data.totals).toEqual({
      incomeMinor: "500000",
      expensesMinor: "150000",
      netMinor: "350000",
      savingsRate: 70,
      transactionCount: 3,
    });

    const breakdown = response.body.data.categoryBreakdown as Array<{
      name: string;
      amountMinor: string;
      sharePercent: number;
    }>;
    expect(breakdown[0]).toMatchObject({
      name: "Groceries",
      amountMinor: "120000",
      sharePercent: 80,
    });
    expect(breakdown[1]).toMatchObject({ name: "Dining", amountMinor: "30000", sharePercent: 20 });
  });

  it("builds a dashboard with trend, previous month and recent rows", async () => {
    const { accessToken } = await register();
    const groceries = await categoryId(accessToken, "Groceries");

    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "50000",
      description: "February shop",
      categoryId: groceries,
      occurredAt: "2026-02-10T10:00:00.000Z",
    });
    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "150000",
      description: "March shop",
      categoryId: groceries,
      occurredAt: "2026-03-10T10:00:00.000Z",
    });

    const response = await get("/api/v1/finance/dashboard?month=2026-03", accessToken).expect(200);
    expect(DashboardResponseSchema.safeParse(response.body).success).toBe(true);

    expect(response.body.data.totals.expensesMinor).toBe("150000");
    expect(response.body.data.previous.expensesMinor).toBe("50000");
    expect(response.body.data.changes.expensesPercent).toBe(200);
    expect(response.body.data.changes.incomePercent).toBeNull();
    expect(response.body.data.trend).toHaveLength(6);
    expect(response.body.data.trend.at(-1).month).toBe("2026-03");
    expect(response.body.data.recentTransactions).toHaveLength(2);
  });

  it("returns analytics with a multi-month trend and top merchants", async () => {
    const { accessToken } = await register();
    const groceries = await categoryId(accessToken, "Groceries");

    for (const month of ["2026-01", "2026-02", "2026-03"]) {
      await createTransaction(accessToken, {
        type: "EXPENSE",
        amountMinor: "10000",
        description: `${month} shop`,
        merchant: "Corner Store",
        categoryId: groceries,
        occurredAt: `${month}-10T10:00:00.000Z`,
      });
    }

    const response = await get(
      "/api/v1/finance/analytics?month=2026-03&months=6",
      accessToken,
    ).expect(200);

    expect(AnalyticsResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.data.trend).toHaveLength(6);
    expect(response.body.data.topMerchants[0]).toEqual({
      merchant: "Corner Store",
      amountMinor: "10000",
      count: 1,
    });
  });
});

describe("budgets", () => {
  it("tracks spending against a monthly envelope", async () => {
    const { accessToken } = await register();
    const groceries = await categoryId(accessToken, "Groceries");

    await createTransaction(accessToken, {
      type: "EXPENSE",
      amountMinor: "120000",
      description: "Groceries",
      categoryId: groceries,
      occurredAt: "2026-03-05T10:00:00.000Z",
    });

    const created = await post("/api/v1/finance/budgets", accessToken, {
      categoryId: groceries,
      month: "2026-03",
      amountMinor: "100000",
    }).expect(201);

    expect(created.body.data.budget).toMatchObject({
      month: "2026-03",
      amountMinor: "100000",
      spentMinor: "120000",
      remainingMinor: "-20000",
      progressPercent: 120,
      status: "OVER",
    });

    const list = await get("/api/v1/finance/budgets?month=2026-03", accessToken).expect(200);
    expect(BudgetsResponseSchema.safeParse(list.body).success).toBe(true);
    expect(list.body.data.totals).toEqual({
      budgetedMinor: "100000",
      spentMinor: "120000",
      remainingMinor: "-20000",
    });

    const updated = await patch(
      `/api/v1/finance/budgets/${created.body.data.budget.id}`,
      accessToken,
      { amountMinor: "200000" },
    ).expect(200);
    expect(updated.body.data.budget.status).toBe("ON_TRACK");
  });

  it("rejects duplicates and income categories", async () => {
    const { accessToken } = await register();
    const groceries = await categoryId(accessToken, "Groceries");
    const salary = await categoryId(accessToken, "Salary");

    await post("/api/v1/finance/budgets", accessToken, {
      categoryId: groceries,
      month: "2026-03",
      amountMinor: "100000",
    }).expect(201);

    const duplicate = await post("/api/v1/finance/budgets", accessToken, {
      categoryId: groceries,
      month: "2026-03",
      amountMinor: "50000",
    }).expect(409);
    expect(duplicate.body.error.code).toBe("BUDGET_EXISTS");

    const income = await post("/api/v1/finance/budgets", accessToken, {
      categoryId: salary,
      month: "2026-03",
      amountMinor: "50000",
    }).expect(422);
    expect(income.body.error.code).toBe("CATEGORY_TYPE_MISMATCH");
  });

  it("deletes a budget", async () => {
    const { accessToken } = await register();
    const groceries = await categoryId(accessToken, "Groceries");

    const created = await post("/api/v1/finance/budgets", accessToken, {
      categoryId: groceries,
      amountMinor: "100000",
    }).expect(201);

    await del(`/api/v1/finance/budgets/${created.body.data.budget.id}`, accessToken).expect(200);
    await del(`/api/v1/finance/budgets/${created.body.data.budget.id}`, accessToken).expect(404);
  });
});

describe("goals", () => {
  it("derives progress from contributions and honours archiving", async () => {
    const { accessToken } = await register();

    const created = await post("/api/v1/finance/goals", accessToken, {
      name: "Emergency fund",
      targetAmountMinor: "100000",
      targetDate: "2026-12-31",
      notes: "Six months of expenses",
    }).expect(201);

    const goalId = created.body.data.goal.id as string;
    expect(created.body.data.goal).toMatchObject({
      targetAmountMinor: "100000",
      savedMinor: "0",
      progressPercent: 0,
      isReached: false,
      status: "ACTIVE",
      targetDate: "2026-12-31",
    });

    const first = await post(`/api/v1/finance/goals/${goalId}/contributions`, accessToken, {
      amountMinor: "40000",
      occurredAt: "2026-03-01",
    }).expect(201);

    expect(GoalContributionResponseSchema.safeParse(first.body).success).toBe(true);
    expect(first.body.data.goal.savedMinor).toBe("40000");
    expect(first.body.data.goal.progressPercent).toBe(40);

    const second = await post(`/api/v1/finance/goals/${goalId}/contributions`, accessToken, {
      amountMinor: "70000",
    }).expect(201);
    expect(second.body.data.goal).toMatchObject({
      savedMinor: "110000",
      remainingMinor: "0",
      progressPercent: 110,
      isReached: true,
      contributionCount: 2,
    });

    const list = await get("/api/v1/finance/goals", accessToken).expect(200);
    expect(GoalsResponseSchema.safeParse(list.body).success).toBe(true);
    expect(list.body.data.goals).toHaveLength(1);

    const contributions = await get(
      `/api/v1/finance/goals/${goalId}/contributions`,
      accessToken,
    ).expect(200);
    expect(GoalContributionsResponseSchema.safeParse(contributions.body).success).toBe(true);
    expect(contributions.body.data.contributions).toHaveLength(2);

    await patch(`/api/v1/finance/goals/${goalId}`, accessToken, { status: "ARCHIVED" }).expect(200);

    const archived = await post(`/api/v1/finance/goals/${goalId}/contributions`, accessToken, {
      amountMinor: "5000",
    }).expect(409);
    expect(archived.body.error.code).toBe("GOAL_ARCHIVED");

    const contributionId = first.body.data.contribution.id as string;
    const removed = await del(
      `/api/v1/finance/goals/${goalId}/contributions/${contributionId}`,
      accessToken,
    ).expect(200);
    expect(removed.body.data.goal.savedMinor).toBe("70000");

    await del(`/api/v1/finance/goals/${goalId}`, accessToken).expect(200);
    await get(`/api/v1/finance/goals/${goalId}`, accessToken).expect(404);
  });

  it("validates goal input", async () => {
    const { accessToken } = await register();

    const emptyName = await post("/api/v1/finance/goals", accessToken, {
      name: "",
      targetAmountMinor: "100000",
    }).expect(422);
    expect(emptyName.body.error.code).toBe("VALIDATION_ERROR");

    const badDate = await post("/api/v1/finance/goals", accessToken, {
      name: "New laptop",
      targetAmountMinor: "100000",
      targetDate: "2026-13-01",
    }).expect(422);
    expect(badDate.body.error.details.fields.targetDate).toBeDefined();
  });
});

describe("workspace isolation", () => {
  it("hides another workspace's rows behind 404s", async () => {
    const owner = await register("Owner Workspace");
    const intruder = await register("Intruder Workspace");

    const groceries = await categoryId(owner.accessToken, "Groceries");
    const created = await createTransaction(owner.accessToken, {
      type: "EXPENSE",
      amountMinor: "10000",
      description: "Private purchase",
      categoryId: groceries,
      occurredAt: "2026-03-05T10:00:00.000Z",
    });
    const transactionId = created.body.data.transaction.id as string;

    const budget = await post("/api/v1/finance/budgets", owner.accessToken, {
      categoryId: groceries,
      month: "2026-03",
      amountMinor: "10000",
    }).expect(201);
    const budgetId = budget.body.data.budget.id as string;

    const goal = await post("/api/v1/finance/goals", owner.accessToken, {
      name: "Private goal",
      targetAmountMinor: "10000",
    }).expect(201);
    const goalId = goal.body.data.goal.id as string;

    const list = await get("/api/v1/finance/transactions", intruder.accessToken).expect(200);
    expect(list.body.data.transactions).toEqual([]);

    for (const path of [
      `/api/v1/finance/transactions/${transactionId}`,
      `/api/v1/finance/goals/${goalId}/contributions`,
    ]) {
      await get(path, intruder.accessToken).expect(404);
    }

    await patch(`/api/v1/finance/transactions/${transactionId}`, intruder.accessToken, {
      amountMinor: "1",
    }).expect(404);
    await del(`/api/v1/finance/transactions/${transactionId}`, intruder.accessToken).expect(404);

    await patch(`/api/v1/finance/budgets/${budgetId}`, intruder.accessToken, {
      amountMinor: "1",
    }).expect(404);
    await del(`/api/v1/finance/budgets/${budgetId}`, intruder.accessToken).expect(404);

    await patch(`/api/v1/finance/goals/${goalId}`, intruder.accessToken, {
      name: "Stolen",
    }).expect(404);
    await del(`/api/v1/finance/goals/${goalId}`, intruder.accessToken).expect(404);

    // The owner's data is untouched.
    const stillThere = await get(
      `/api/v1/finance/transactions/${transactionId}`,
      owner.accessToken,
    ).expect(200);
    expect(stillThere.body.data.transaction.description).toBe("Private purchase");
  });
});
