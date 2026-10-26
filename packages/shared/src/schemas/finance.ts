import { z } from "zod";
import { CurrencySchema, SortOrderSchema } from "./common.js";

/**
 * Phase 3 finance contracts. Every request and response crosses the wire through
 * one of these schemas so the API and the React client cannot drift apart.
 *
 * Money is always an integer decimal string in minor units. Validation happens
 * before the database and again after JSON serialization.
 */

export const CategoryKindSchema = z.enum(["INCOME", "EXPENSE"]);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

/** Budget and reporting months are calendar months, independent of time zones. */
export const MonthSchema = z
  .string()
  .trim()
  .regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/, "Use a month like 2026-10");

export type Month = z.infer<typeof MonthSchema>;

export const DateOnlySchema = z.iso.date();
export type DateOnly = z.infer<typeof DateOnlySchema>;

export const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #10b981")
  .transform((value) => value.toLowerCase());

/** Positive integer minor units, encoded as a decimal string. */
export const PositiveMinorAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,18}$/, "Enter an amount in minor units")
  .refine((value) => /[1-9]/.test(value), "Amount must be greater than zero");

/** Human-friendly decimal input used by the web forms (e.g. "1,250.00" is stripped client-side). */
export const DecimalAmountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .max(18, "Use a smaller amount")
  .regex(/^\d{1,12}(\.\d{1,3})?$/, "Use a number like 1250.00")
  .refine((value) => /[1-9]/.test(value), "Amount must be greater than zero");

export const GoalStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const BudgetStatusSchema = z.enum(["ON_TRACK", "NEAR_LIMIT", "OVER"]);
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

// ── Categories ───────────────────────────────────────────────────────────────

export const CategoryRefSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(60),
  kind: CategoryKindSchema,
  color: z.string().nullable(),
  icon: z.string().nullable(),
});

export type CategoryRef = z.infer<typeof CategoryRefSchema>;

export const CategorySchema = CategoryRefSchema.extend({
  isSystem: z.boolean(),
  transactionCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Category = z.infer<typeof CategorySchema>;

export const CreateCategoryInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(60, "Use 60 characters or fewer"),
    kind: CategoryKindSchema,
    color: HexColorSchema.optional(),
    icon: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

export const UpdateCategoryInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(60, "Use 60 characters or fewer")
      .optional(),
    color: HexColorSchema.optional(),
    icon: z.string().trim().min(1).max(40).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;

export const CategoryResponseSchema = z.object({
  data: z.object({ category: CategorySchema }),
});

export const CategoriesResponseSchema = z.object({
  data: z.object({ categories: z.array(CategorySchema) }),
});

export type CategoriesResponse = z.infer<typeof CategoriesResponseSchema>;

export const CategoriesQuerySchema = z.object({
  kind: CategoryKindSchema.optional(),
});

export type CategoriesQuery = z.infer<typeof CategoriesQuerySchema>;

// ── Transactions ─────────────────────────────────────────────────────────────

export const TransactionSchema = z.object({
  id: z.uuid(),
  type: CategoryKindSchema,
  amountMinor: PositiveMinorAmountSchema,
  currency: CurrencySchema,
  description: z.string().min(1).max(160),
  merchant: z.string().nullable(),
  notes: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  category: CategoryRefSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

export const CreateTransactionInputSchema = z
  .object({
    type: CategoryKindSchema,
    amountMinor: PositiveMinorAmountSchema,
    description: z
      .string()
      .trim()
      .min(2, "Enter a short description")
      .max(160, "Use 160 characters or fewer"),
    categoryId: z.uuid().nullable().optional(),
    merchant: z.string().trim().max(120, "Use 120 characters or fewer").nullable().optional(),
    notes: z.string().trim().max(1000, "Use 1000 characters or fewer").nullable().optional(),
    occurredAt: z.iso.datetime().optional(),
  })
  .strict();

export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;

export const UpdateTransactionInputSchema = z
  .object({
    type: CategoryKindSchema.optional(),
    amountMinor: PositiveMinorAmountSchema.optional(),
    description: z
      .string()
      .trim()
      .min(2, "Enter a short description")
      .max(160, "Use 160 characters or fewer")
      .optional(),
    categoryId: z.uuid().nullable().optional(),
    merchant: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    occurredAt: z.iso.datetime().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInputSchema>;

export const TransactionListQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    type: CategoryKindSchema.optional(),
    categoryId: z.uuid().optional(),
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    order: SortOrderSchema.default("desc"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "The end date must be on or after the start date",
    path: ["to"],
  });

export type TransactionListQuery = z.infer<typeof TransactionListQuerySchema>;

export const TransactionTotalsSchema = z.object({
  incomeMinor: z.string(),
  expensesMinor: z.string(),
  netMinor: z.string(),
});

export type TransactionTotals = z.infer<typeof TransactionTotalsSchema>;

export const TransactionListMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  totals: TransactionTotalsSchema,
});

export type TransactionListMeta = z.infer<typeof TransactionListMetaSchema>;

export const TransactionResponseSchema = z.object({
  data: z.object({ transaction: TransactionSchema }),
});

export const TransactionsResponseSchema = z.object({
  data: z.object({ transactions: z.array(TransactionSchema) }),
  meta: TransactionListMetaSchema,
});

export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>;

// ── Monthly summaries ────────────────────────────────────────────────────────

export const CategoryBreakdownItemSchema = z.object({
  categoryId: z.uuid().nullable(),
  name: z.string().min(1),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  amountMinor: z.string(),
  sharePercent: z.number().min(0).max(100),
});

export type CategoryBreakdownItem = z.infer<typeof CategoryBreakdownItemSchema>;

export const MonthlyPointSchema = z.object({
  month: MonthSchema,
  incomeMinor: z.string(),
  expensesMinor: z.string(),
  netMinor: z.string(),
});

export type MonthlyPoint = z.infer<typeof MonthlyPointSchema>;

export const MonthlySummaryResponseSchema = z.object({
  data: z.object({
    month: MonthSchema,
    currency: CurrencySchema,
    totals: TransactionTotalsSchema.extend({
      savingsRate: z.number().nullable(),
      transactionCount: z.number().int().nonnegative(),
    }),
    categoryBreakdown: z.array(CategoryBreakdownItemSchema),
  }),
});

export type MonthlySummaryResponse = z.infer<typeof MonthlySummaryResponseSchema>;

export const MonthlySummaryQuerySchema = z.object({
  month: MonthSchema.optional(),
});

export type MonthlySummaryQuery = z.infer<typeof MonthlySummaryQuerySchema>;

// ── Budgets ──────────────────────────────────────────────────────────────────

export const BudgetSchema = z.object({
  id: z.uuid(),
  month: MonthSchema,
  amountMinor: z.string(),
  spentMinor: z.string(),
  remainingMinor: z.string(),
  progressPercent: z.number().nonnegative(),
  status: BudgetStatusSchema,
  category: CategoryRefSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Budget = z.infer<typeof BudgetSchema>;

export const CreateBudgetInputSchema = z
  .object({
    categoryId: z.uuid(),
    month: MonthSchema.optional(),
    amountMinor: PositiveMinorAmountSchema,
  })
  .strict();

export type CreateBudgetInput = z.infer<typeof CreateBudgetInputSchema>;

export const UpdateBudgetInputSchema = z
  .object({
    categoryId: z.uuid().optional(),
    month: MonthSchema.optional(),
    amountMinor: PositiveMinorAmountSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type UpdateBudgetInput = z.infer<typeof UpdateBudgetInputSchema>;

export const BudgetsResponseSchema = z.object({
  data: z.object({
    month: MonthSchema,
    budgets: z.array(BudgetSchema),
    totals: z.object({
      budgetedMinor: z.string(),
      spentMinor: z.string(),
      remainingMinor: z.string(),
    }),
  }),
});

export type BudgetsResponse = z.infer<typeof BudgetsResponseSchema>;

export const BudgetResponseSchema = z.object({
  data: z.object({ budget: BudgetSchema }),
});

export const BudgetsQuerySchema = z.object({
  month: MonthSchema.optional(),
});

export type BudgetsQuery = z.infer<typeof BudgetsQuerySchema>;

// ── Goals ────────────────────────────────────────────────────────────────────

export const GoalSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  targetAmountMinor: z.string(),
  savedMinor: z.string(),
  remainingMinor: z.string(),
  progressPercent: z.number().nonnegative(),
  isReached: z.boolean(),
  currency: CurrencySchema,
  targetDate: DateOnlySchema.nullable(),
  status: GoalStatusSchema,
  notes: z.string().nullable(),
  contributionCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Goal = z.infer<typeof GoalSchema>;

export const CreateGoalInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(80, "Use 80 characters or fewer"),
    targetAmountMinor: PositiveMinorAmountSchema,
    targetDate: DateOnlySchema.nullable().optional(),
    notes: z.string().trim().max(500, "Use 500 characters or fewer").nullable().optional(),
  })
  .strict();

export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;

export const UpdateGoalInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    targetAmountMinor: PositiveMinorAmountSchema.optional(),
    targetDate: DateOnlySchema.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    status: GoalStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;

export const GoalContributionSchema = z.object({
  id: z.uuid(),
  goalId: z.uuid(),
  amountMinor: z.string(),
  occurredAt: DateOnlySchema,
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type GoalContribution = z.infer<typeof GoalContributionSchema>;

export const CreateGoalContributionInputSchema = z
  .object({
    amountMinor: PositiveMinorAmountSchema,
    occurredAt: DateOnlySchema.optional(),
    note: z.string().trim().max(300, "Use 300 characters or fewer").nullable().optional(),
  })
  .strict();

export type CreateGoalContributionInput = z.infer<typeof CreateGoalContributionInputSchema>;

export const GoalsResponseSchema = z.object({
  data: z.object({ goals: z.array(GoalSchema) }),
});

export type GoalsResponse = z.infer<typeof GoalsResponseSchema>;

export const GoalsQuerySchema = z.object({
  status: GoalStatusSchema.optional(),
});

export type GoalsQuery = z.infer<typeof GoalsQuerySchema>;

export const GoalResponseSchema = z.object({
  data: z.object({ goal: GoalSchema }),
});

export const GoalContributionsResponseSchema = z.object({
  data: z.object({
    goal: GoalSchema,
    contributions: z.array(GoalContributionSchema),
  }),
});

export type GoalContributionsResponse = z.infer<typeof GoalContributionsResponseSchema>;

export const GoalContributionResponseSchema = z.object({
  data: z.object({
    goal: GoalSchema,
    contribution: GoalContributionSchema,
  }),
});

export const GoalIdParamsSchema = z.object({ id: z.uuid() });
export const GoalContributionParamsSchema = z.object({
  id: z.uuid(),
  contributionId: z.uuid(),
});
export const IdParamsSchema = z.object({ id: z.uuid() });

// ── Dashboard and analytics ──────────────────────────────────────────────────

export const DashboardQuerySchema = z.object({
  month: MonthSchema.optional(),
});

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export const DashboardResponseSchema = z.object({
  data: z.object({
    month: MonthSchema,
    currency: CurrencySchema,
    totals: TransactionTotalsSchema.extend({
      savingsRate: z.number().nullable(),
      transactionCount: z.number().int().nonnegative(),
    }),
    previous: TransactionTotalsSchema,
    changes: z.object({
      incomePercent: z.number().nullable(),
      expensesPercent: z.number().nullable(),
    }),
    trend: z.array(MonthlyPointSchema),
    categoryBreakdown: z.array(CategoryBreakdownItemSchema),
    recentTransactions: z.array(TransactionSchema),
    budgets: z.array(BudgetSchema),
    goals: z.array(GoalSchema),
  }),
});

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

export const AnalyticsQuerySchema = z.object({
  month: MonthSchema.optional(),
  months: z.coerce.number().int().min(3).max(24).default(12),
});

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

export const AnalyticsResponseSchema = z.object({
  data: z.object({
    month: MonthSchema,
    months: z.number().int().positive(),
    currency: CurrencySchema,
    totals: TransactionTotalsSchema.extend({
      savingsRate: z.number().nullable(),
      transactionCount: z.number().int().nonnegative(),
    }),
    trend: z.array(MonthlyPointSchema),
    categoryBreakdown: z.array(CategoryBreakdownItemSchema),
    topMerchants: z.array(
      z.object({
        merchant: z.string(),
        amountMinor: z.string(),
        count: z.number().int().positive(),
      }),
    ),
  }),
});

export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
