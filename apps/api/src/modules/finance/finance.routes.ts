import { Router, type Request, type Response } from "express";
import type { z } from "zod";
import {
  AnalyticsQuerySchema,
  BudgetsQuerySchema,
  CategoriesQuerySchema,
  CreateBudgetInputSchema,
  CreateCategoryInputSchema,
  CreateGoalContributionInputSchema,
  CreateGoalInputSchema,
  CreateTransactionInputSchema,
  DashboardQuerySchema,
  GoalsQuerySchema,
  IdParamsSchema,
  GoalContributionParamsSchema,
  MonthlySummaryQuerySchema,
  TransactionListQuerySchema,
  UpdateBudgetInputSchema,
  UpdateCategoryInputSchema,
  UpdateGoalInputSchema,
  UpdateTransactionInputSchema,
  type AnalyticsQuery,
  type BudgetsQuery,
  type CategoriesQuery,
  type CreateBudgetInput,
  type CreateCategoryInput,
  type CreateGoalContributionInput,
  type CreateGoalInput,
  type CreateTransactionInput,
  type DashboardQuery,
  type GoalsQuery,
  type MessageResponse,
  type MonthlySummaryQuery,
  type TransactionListQuery,
  type UpdateBudgetInput,
  type UpdateCategoryInput,
  type UpdateGoalInput,
  type UpdateTransactionInput,
} from "@moneymind/shared";
import { sendSuccess } from "../../lib/api-response.js";
import { requireActiveSession, requireAuth } from "../../middleware/authenticate.js";
import {
  getValidatedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validate.js";
import { getAnalytics, getDashboard, getMonthlySummary } from "./analytics.service.js";
import { createBudget, deleteBudget, listBudgets, updateBudget } from "./budgets.service.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./categories.service.js";
import { loadFinanceContext } from "./finance.context.js";
import {
  addContribution,
  createGoal,
  deleteContribution,
  deleteGoal,
  getGoal,
  listContributions,
  listGoals,
  updateGoal,
} from "./goals.service.js";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "./transactions.service.js";

export const financeRouter: Router = Router();

// Every finance route requires a live session, not just a valid JWT, so a
// revoked device cannot keep reading or writing money data until token expiry.
financeRouter.use("/finance", requireAuth, requireActiveSession);

function messagePayload(message: string): MessageResponse["data"] {
  return { message };
}

// ── Categories ───────────────────────────────────────────────────────────────

financeRouter.get(
  "/finance/categories",
  validateQuery(CategoriesQuerySchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const query = getValidatedQuery<CategoriesQuery>(req);
    const categories = await listCategories(ctx, query);

    sendSuccess(res, { categories });
  },
);

financeRouter.post(
  "/finance/categories",
  validateBody<CreateCategoryInput>(CreateCategoryInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const category = await createCategory(ctx, req.body as CreateCategoryInput);

    sendSuccess(res, { category }, { status: 201 });
  },
);

financeRouter.patch(
  "/finance/categories/:id",
  validateParams(IdParamsSchema),
  validateBody<UpdateCategoryInput>(UpdateCategoryInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const category = await updateCategory(ctx, id, req.body as UpdateCategoryInput);

    sendSuccess(res, { category });
  },
);

financeRouter.delete(
  "/finance/categories/:id",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    await deleteCategory(ctx, id);

    sendSuccess(res, messagePayload("Category deleted."));
  },
);

// ── Transactions ─────────────────────────────────────────────────────────────

financeRouter.get(
  "/finance/transactions",
  validateQuery(TransactionListQuerySchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const query = getValidatedQuery<TransactionListQuery>(req);
    const { transactions, meta } = await listTransactions(ctx, query);

    sendSuccess(res, { transactions }, { meta });
  },
);

financeRouter.get(
  "/finance/transactions/:id",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const transaction = await getTransaction(ctx, id);

    sendSuccess(res, { transaction });
  },
);

financeRouter.post(
  "/finance/transactions",
  validateBody<CreateTransactionInput>(CreateTransactionInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const transaction = await createTransaction(ctx, req.body as CreateTransactionInput);

    sendSuccess(res, { transaction }, { status: 201 });
  },
);

financeRouter.patch(
  "/finance/transactions/:id",
  validateParams(IdParamsSchema),
  validateBody<UpdateTransactionInput>(UpdateTransactionInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const transaction = await updateTransaction(ctx, id, req.body as UpdateTransactionInput);

    sendSuccess(res, { transaction });
  },
);

financeRouter.delete(
  "/finance/transactions/:id",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    await deleteTransaction(ctx, id);

    sendSuccess(res, messagePayload("Transaction deleted."));
  },
);

// ── Summary ──────────────────────────────────────────────────────────────────

financeRouter.get(
  "/finance/summary",
  validateQuery(MonthlySummaryQuerySchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { month } = getValidatedQuery<MonthlySummaryQuery>(req);
    const summary = await getMonthlySummary(ctx, month);

    sendSuccess(res, summary);
  },
);

// ── Budgets ──────────────────────────────────────────────────────────────────

financeRouter.get(
  "/finance/budgets",
  validateQuery(BudgetsQuerySchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { month } = getValidatedQuery<BudgetsQuery>(req);
    const budgets = await listBudgets(ctx, month);

    sendSuccess(res, budgets);
  },
);

financeRouter.post(
  "/finance/budgets",
  validateBody<CreateBudgetInput>(CreateBudgetInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const budget = await createBudget(ctx, req.body as CreateBudgetInput);

    sendSuccess(res, { budget }, { status: 201 });
  },
);

financeRouter.patch(
  "/finance/budgets/:id",
  validateParams(IdParamsSchema),
  validateBody<UpdateBudgetInput>(UpdateBudgetInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const budget = await updateBudget(ctx, id, req.body as UpdateBudgetInput);

    sendSuccess(res, { budget });
  },
);

financeRouter.delete(
  "/finance/budgets/:id",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    await deleteBudget(ctx, id);

    sendSuccess(res, messagePayload("Budget deleted."));
  },
);

// ── Goals ────────────────────────────────────────────────────────────────────

financeRouter.get(
  "/finance/goals",
  validateQuery(GoalsQuerySchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { status } = getValidatedQuery<GoalsQuery>(req);
    const goals = await listGoals(ctx, status);

    sendSuccess(res, { goals });
  },
);

financeRouter.post(
  "/finance/goals",
  validateBody<CreateGoalInput>(CreateGoalInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const goal = await createGoal(ctx, req.body as CreateGoalInput);

    sendSuccess(res, { goal }, { status: 201 });
  },
);

financeRouter.get(
  "/finance/goals/:id",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const goal = await getGoal(ctx, id);

    sendSuccess(res, { goal });
  },
);

financeRouter.patch(
  "/finance/goals/:id",
  validateParams(IdParamsSchema),
  validateBody<UpdateGoalInput>(UpdateGoalInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const goal = await updateGoal(ctx, id, req.body as UpdateGoalInput);

    sendSuccess(res, { goal });
  },
);

financeRouter.delete(
  "/finance/goals/:id",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    await deleteGoal(ctx, id);

    sendSuccess(res, messagePayload("Goal deleted."));
  },
);

financeRouter.get(
  "/finance/goals/:id/contributions",
  validateParams(IdParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const payload = await listContributions(ctx, id);

    sendSuccess(res, payload);
  },
);

financeRouter.post(
  "/finance/goals/:id/contributions",
  validateParams(IdParamsSchema),
  validateBody<CreateGoalContributionInput>(CreateGoalContributionInputSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const payload = await addContribution(ctx, id, req.body as CreateGoalContributionInput);

    sendSuccess(res, payload, { status: 201 });
  },
);

financeRouter.delete(
  "/finance/goals/:id/contributions/:contributionId",
  validateParams(GoalContributionParamsSchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { id, contributionId } = req.params as z.infer<typeof GoalContributionParamsSchema>;
    const { goal } = await deleteContribution(ctx, id, contributionId);

    sendSuccess(res, { goal });
  },
);

// ── Dashboard and analytics ──────────────────────────────────────────────────

financeRouter.get(
  "/finance/dashboard",
  validateQuery(DashboardQuerySchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const { month } = getValidatedQuery<DashboardQuery>(req);
    const dashboard = await getDashboard(ctx, month);

    sendSuccess(res, dashboard);
  },
);

financeRouter.get(
  "/finance/analytics",
  validateQuery(AnalyticsQuerySchema),
  async (req: Request, res: Response) => {
    const ctx = await loadFinanceContext(req);
    const query = getValidatedQuery<AnalyticsQuery>(req);
    const analytics = await getAnalytics(ctx, query.month, query.months);

    sendSuccess(res, analytics);
  },
);
