import { describe, expect, it } from "vitest";
import {
  AnalyticsQuerySchema,
  CreateBudgetInputSchema,
  CreateCategoryInputSchema,
  CreateGoalInputSchema,
  CreateTransactionInputSchema,
  DashboardResponseSchema,
  HexColorSchema,
  MonthSchema,
  MonthlyPointSchema,
  TransactionListQuerySchema,
  UpdateTransactionInputSchema,
} from "./finance.js";

describe("MonthSchema", () => {
  it("accepts canonical months and rejects impossible ones", () => {
    expect(MonthSchema.parse("2026-10")).toBe("2026-10");
    expect(MonthSchema.safeParse("2026-13").success).toBe(false);
    expect(MonthSchema.safeParse("2026-1").success).toBe(false);
  });
});

describe("HexColorSchema", () => {
  it("normalises to lowercase", () => {
    expect(HexColorSchema.parse("#10B981")).toBe("#10b981");
    expect(HexColorSchema.safeParse("10b981").success).toBe(false);
    expect(HexColorSchema.safeParse("#fff").success).toBe(false);
  });
});

describe("CreateTransactionInputSchema", () => {
  const valid = {
    type: "EXPENSE",
    amountMinor: "1250",
    description: "Coffee",
  };

  it("accepts a minimal payload and applies optional fields", () => {
    expect(CreateTransactionInputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects zero, negative and non-integer amounts", () => {
    for (const amountMinor of ["0", "-100", "12.50", "abc", "0000"]) {
      expect(CreateTransactionInputSchema.safeParse({ ...valid, amountMinor }).success).toBe(false);
    }
  });

  it("rejects unexpected fields", () => {
    expect(CreateTransactionInputSchema.safeParse({ ...valid, workspaceId: "x" }).success).toBe(
      false,
    );
  });

  it("rejects an empty update", () => {
    expect(UpdateTransactionInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateTransactionInputSchema.parse({ merchant: null })).toEqual({ merchant: null });
  });
});

describe("TransactionListQuerySchema", () => {
  it("coerces paging strings and applies defaults", () => {
    expect(TransactionListQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
      order: "desc",
    });

    expect(
      TransactionListQuerySchema.parse({ page: "2", limit: "50", order: "asc" }),
    ).toMatchObject({ page: 2, limit: 50, order: "asc" });
  });

  it("caps the page size", () => {
    expect(TransactionListQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });

  it("rejects an inverted date range with a field error", () => {
    const result = TransactionListQuerySchema.safeParse({ from: "2026-03-31", to: "2026-03-01" });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["to"]);
    }
  });
});

describe("finance inputs", () => {
  it("validates category colours and names", () => {
    expect(
      CreateCategoryInputSchema.parse({ name: "Pets", kind: "EXPENSE", color: "#10B981" }),
    ).toEqual({ name: "Pets", kind: "EXPENSE", color: "#10b981" });

    expect(CreateCategoryInputSchema.safeParse({ name: "P", kind: "EXPENSE" }).success).toBe(false);
  });

  it("requires a positive budget amount and category", () => {
    expect(
      CreateBudgetInputSchema.parse({
        categoryId: "3f1d9e66-2c3f-4d9a-9f0e-0b7c7f9b8a11",
        amountMinor: "5000",
      }),
    ).toMatchObject({ amountMinor: "5000" });

    expect(
      CreateBudgetInputSchema.safeParse({
        categoryId: "not-a-uuid",
        amountMinor: "0",
      }).success,
    ).toBe(false);
  });

  it("validates goal targets and dates", () => {
    expect(
      CreateGoalInputSchema.safeParse({
        name: "Emergency fund",
        targetAmountMinor: "100000",
        targetDate: "2026-12-31",
      }).success,
    ).toBe(true);

    expect(
      CreateGoalInputSchema.safeParse({
        name: "Emergency fund",
        targetAmountMinor: "100000",
        targetDate: "2026-02-31",
      }).success,
    ).toBe(false);
  });

  it("coerces analytics ranges and enforces bounds", () => {
    expect(AnalyticsQuerySchema.parse({})).toEqual({ months: 12 });
    expect(AnalyticsQuerySchema.parse({ months: "6" })).toEqual({ months: 6 });
    expect(AnalyticsQuerySchema.safeParse({ months: "2" }).success).toBe(false);
    expect(AnalyticsQuerySchema.safeParse({ months: "25" }).success).toBe(false);
  });
});

describe("response contracts", () => {
  it("accepts a monthly trend point", () => {
    expect(
      MonthlyPointSchema.parse({
        month: "2026-03",
        incomeMinor: "1000",
        expensesMinor: "400",
        netMinor: "600",
      }),
    ).toMatchObject({ month: "2026-03" });
  });

  it("rejects a dashboard without a trend array", () => {
    expect(DashboardResponseSchema.safeParse({ data: {} }).success).toBe(false);
  });
});
