import type { Prisma } from "@prisma/client";
import type {
  CreateGoalContributionInput,
  CreateGoalInput,
  Goal,
  GoalContribution,
  GoalStatus,
  UpdateGoalInput,
} from "@moneymind/shared";
import { dateOnlyInTimeZone } from "@moneymind/shared";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import type { FinanceContext } from "./finance.context.js";

const goalInclude = {
  _count: { select: { contributions: true } },
} satisfies Prisma.GoalInclude;

type GoalRow = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

function parseDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toGoal(row: GoalRow, savedMinor: bigint): Goal {
  const target = row.targetAmountMinor;
  const remaining = target > savedMinor ? target - savedMinor : 0n;

  return {
    id: row.id,
    name: row.name,
    targetAmountMinor: target.toString(),
    savedMinor: savedMinor.toString(),
    remainingMinor: remaining.toString(),
    progressPercent: Number((savedMinor * 1000n) / target) / 10,
    isReached: savedMinor >= target,
    currency: row.currency,
    targetDate: row.targetDate ? formatDateOnly(row.targetDate) : null,
    status: row.status,
    notes: row.notes,
    contributionCount: row._count.contributions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toGoalContribution(row: {
  id: string;
  goalId: string;
  amountMinor: bigint;
  occurredAt: Date;
  note: string | null;
  createdAt: Date;
}): GoalContribution {
  return {
    id: row.id,
    goalId: row.goalId,
    amountMinor: row.amountMinor.toString(),
    occurredAt: formatDateOnly(row.occurredAt),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

async function savedByGoal(goalIds: string[]): Promise<Map<string, bigint>> {
  if (goalIds.length === 0) return new Map();

  const grouped = await prisma.goalContribution.groupBy({
    by: ["goalId"],
    where: { goalId: { in: goalIds } },
    _sum: { amountMinor: true },
  });

  return new Map(grouped.map((group) => [group.goalId, group._sum.amountMinor ?? 0n]));
}

export async function listGoals(ctx: FinanceContext, status?: GoalStatus): Promise<Goal[]> {
  const rows = await prisma.goal.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
    },
    include: goalInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const savings = await savedByGoal(rows.map((row) => row.id));

  return rows.map((row) => toGoal(row, savings.get(row.id) ?? 0n));
}

async function findGoalRow(ctx: FinanceContext, id: string): Promise<GoalRow> {
  const row = await prisma.goal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: goalInclude,
  });

  if (!row) {
    throw new AppError(404, "GOAL_NOT_FOUND", "That savings goal does not exist.");
  }

  return row;
}

export async function getGoal(ctx: FinanceContext, id: string): Promise<Goal> {
  const row = await findGoalRow(ctx, id);
  const savings = await savedByGoal([row.id]);

  return toGoal(row, savings.get(row.id) ?? 0n);
}

export async function createGoal(ctx: FinanceContext, input: CreateGoalInput): Promise<Goal> {
  const created = await prisma.goal.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      targetAmountMinor: BigInt(input.targetAmountMinor),
      currency: ctx.currency,
      targetDate: input.targetDate ? parseDateOnly(input.targetDate) : null,
      notes: input.notes ?? null,
    },
    include: goalInclude,
  });

  return toGoal(created, 0n);
}

export async function updateGoal(
  ctx: FinanceContext,
  id: string,
  input: UpdateGoalInput,
): Promise<Goal> {
  const existing = await findGoalRow(ctx, id);

  const updated = await prisma.goal.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.targetAmountMinor !== undefined
        ? { targetAmountMinor: BigInt(input.targetAmountMinor) }
        : {}),
      ...(input.targetDate !== undefined
        ? { targetDate: input.targetDate ? parseDateOnly(input.targetDate) : null }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: goalInclude,
  });

  const savings = await savedByGoal([updated.id]);

  return toGoal(updated, savings.get(updated.id) ?? 0n);
}

export async function deleteGoal(ctx: FinanceContext, id: string): Promise<void> {
  const result = await prisma.goal.deleteMany({
    where: { id, workspaceId: ctx.workspaceId },
  });

  if (result.count === 0) {
    throw new AppError(404, "GOAL_NOT_FOUND", "That savings goal does not exist.");
  }
}

export async function listContributions(
  ctx: FinanceContext,
  goalId: string,
): Promise<{ goal: Goal; contributions: GoalContribution[] }> {
  const goal = await getGoal(ctx, goalId);

  const contributions = await prisma.goalContribution.findMany({
    where: { goalId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });

  return {
    goal,
    contributions: contributions.map(toGoalContribution),
  };
}

export async function addContribution(
  ctx: FinanceContext,
  goalId: string,
  input: CreateGoalContributionInput,
): Promise<{ goal: Goal; contribution: GoalContribution }> {
  const existing = await findGoalRow(ctx, goalId);

  if (existing.status === "ARCHIVED") {
    throw new AppError(409, "GOAL_ARCHIVED", "Reopen this goal before adding contributions.");
  }

  const created = await prisma.goalContribution.create({
    data: {
      goalId: existing.id,
      amountMinor: BigInt(input.amountMinor),
      occurredAt: parseDateOnly(input.occurredAt ?? dateOnlyInTimeZone(new Date(), ctx.timezone)),
      note: input.note ?? null,
    },
  });

  const goal = await getGoal(ctx, goalId);

  return { goal, contribution: toGoalContribution(created) };
}

export async function deleteContribution(
  ctx: FinanceContext,
  goalId: string,
  contributionId: string,
): Promise<{ goal: Goal }> {
  await findGoalRow(ctx, goalId);

  const result = await prisma.goalContribution.deleteMany({
    where: { id: contributionId, goalId },
  });

  if (result.count === 0) {
    throw new AppError(404, "CONTRIBUTION_NOT_FOUND", "That contribution does not exist.");
  }

  return { goal: await getGoal(ctx, goalId) };
}
