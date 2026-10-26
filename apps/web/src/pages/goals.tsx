import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Flag,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Goal, GoalContribution } from "@moneymind/shared";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLoading } from "@/components/auth/auth-loading";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ContributionDialog } from "@/components/finance/contribution-dialog";
import { GoalDialog } from "@/components/finance/goal-dialog";
import { PageHeader } from "@/components/finance/page-header";
import { ProgressBar } from "@/components/finance/progress";
import { QueryError } from "@/components/finance/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api";
import { formatDateOnlyLabel, formatMinor } from "@/lib/finance";
import { useAuth } from "@/providers/auth-provider";

export default function GoalsPage() {
  usePageTitle("Goals");
  const { user } = useAuth();

  if (!user) {
    return <AuthLoading label="Loading your goals…" />;
  }

  return (
    <AppShell>
      <GoalsView
        currency={user.workspace.baseCurrency}
        timezone={user.timezone}
        locale={user.locale}
      />
    </AppShell>
  );
}

type PendingDeletion =
  | { kind: "goal"; goal: Goal }
  | { kind: "contribution"; goal: Goal; contribution: GoalContribution };

function GoalsView({
  currency,
  timezone,
  locale,
}: {
  currency: string;
  timezone: string;
  locale: string;
}) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);

  const goalsQuery = useQuery({
    queryKey: ["finance", "goals"],
    queryFn: () => api.goals(),
  });

  const contributionsQuery = useQuery({
    queryKey: ["finance", "goals", expanded, "contributions"],
    queryFn: () => api.goalContributions(expanded as string),
    enabled: Boolean(expanded),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance"] });

  const archiveMutation = useMutation({
    mutationFn: (goal: Goal) =>
      api.updateGoal(goal.id, { status: goal.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (pending: PendingDeletion) => {
      if (pending.kind === "goal") {
        await api.deleteGoal(pending.goal.id);
        return;
      }

      await api.deleteGoalContribution(pending.goal.id, pending.contribution.id);
    },
    onSuccess: async () => {
      if (pendingDeletion?.kind === "contribution") {
        await queryClient.invalidateQueries({
          queryKey: ["finance", "goals", pendingDeletion.goal.id, "contributions"],
        });
      }
      await invalidate();
    },
  });

  const goals = goalsQuery.data ?? [];
  const active = goals.filter((goal) => goal.status === "ACTIVE");
  const archived = goals.filter((goal) => goal.status === "ARCHIVED");

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 3 · Core finance"
        title="Goals"
        description="Set a target, add what you set aside, and watch progress move. Contributions are the only source of truth."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden="true" />
            New goal
          </Button>
        }
      />

      {goalsQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((card) => (
            <Card key={card}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : goalsQuery.isError ? (
        <QueryError
          error={goalsQuery.error}
          onRetry={() => void goalsQuery.refetch()}
          isRetrying={goalsQuery.isFetching}
          title="Goals could not be loaded"
          className="py-16"
        />
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={Flag}
              title="No savings goals yet"
              description="Name what you are saving for, set the target and add contributions whenever you put money aside."
              className="min-h-[240px]"
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus aria-hidden="true" />
                  Create your first goal
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {active.length === 0 ? (
            <Card>
              <CardContent className="p-5">
                <EmptyState
                  icon={Flag}
                  title="Nothing active right now"
                  description="Every goal is archived. Reopen one or start a new target."
                  action={
                    <Button size="sm" onClick={openCreate}>
                      <Plus aria-hidden="true" />
                      New goal
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {active.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  currency={currency}
                  locale={locale}
                  expanded={expanded === goal.id}
                  onToggleHistory={() =>
                    setExpanded((current) => (current === goal.id ? null : goal.id))
                  }
                  contributions={expanded === goal.id ? contributionsQuery : undefined}
                  onEdit={() => {
                    setEditing(goal);
                    setFormOpen(true);
                  }}
                  onContribute={() => setContributing(goal)}
                  onArchive={() => archiveMutation.mutate(goal)}
                  archiving={archiveMutation.isPending && archiveMutation.variables?.id === goal.id}
                  onDelete={() => setPendingDeletion({ kind: "goal", goal })}
                  onDeleteContribution={(contribution) =>
                    setPendingDeletion({ kind: "contribution", goal, contribution })
                  }
                />
              ))}
            </div>
          )}

          {archived.length > 0 ? (
            <section aria-labelledby="archived-goals" className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 id="archived-goals" className="text-sm font-semibold tracking-tight">
                  Archived
                </h2>
                <Badge variant="secondary">{archived.length}</Badge>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/60">
                    {archived.map((goal) => (
                      <li
                        key={goal.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Archive aria-hidden="true" className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{goal.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatMinor(goal.savedMinor, currency, locale)} of{" "}
                            {formatMinor(goal.targetAmountMinor, currency, locale)} saved ·{" "}
                            {goal.progressPercent.toFixed(0)}%
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => archiveMutation.mutate(goal)}
                          disabled={archiveMutation.isPending}
                        >
                          <RotateCcw aria-hidden="true" />
                          Reopen
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDeletion({ kind: "goal", goal })}
                          aria-label={`Delete ${goal.name}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ) : null}
        </>
      )}

      <GoalDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        goal={editing}
        currency={currency}
      />

      <ContributionDialog
        open={Boolean(contributing)}
        onClose={() => setContributing(null)}
        goal={contributing}
        currency={currency}
        timezone={timezone}
      />

      <ConfirmDialog
        open={Boolean(pendingDeletion)}
        onClose={() => setPendingDeletion(null)}
        onConfirm={async () => {
          if (!pendingDeletion) return;
          await deleteMutation.mutateAsync(pendingDeletion);
        }}
        title={pendingDeletion?.kind === "contribution" ? "Delete contribution?" : "Delete goal?"}
        description={
          pendingDeletion?.kind === "contribution"
            ? `This contribution will be removed from “${pendingDeletion.goal.name}” and progress will be recalculated.`
            : pendingDeletion
              ? `“${pendingDeletion.goal.name}” and all of its contribution history will be deleted.`
              : ""
        }
        confirmLabel={
          pendingDeletion?.kind === "contribution" ? "Delete contribution" : "Delete goal"
        }
      />
    </div>
  );
}

function GoalCard({
  goal,
  currency,
  locale,
  expanded,
  onToggleHistory,
  contributions,
  onEdit,
  onContribute,
  onArchive,
  archiving,
  onDelete,
  onDeleteContribution,
}: {
  goal: Goal;
  currency: string;
  locale: string;
  expanded: boolean;
  onToggleHistory: () => void;
  contributions?: ReturnType<typeof useQuery<{ goal: Goal; contributions: GoalContribution[] }>>;
  onEdit: () => void;
  onContribute: () => void;
  onArchive: () => void;
  archiving: boolean;
  onDelete: () => void;
  onDeleteContribution: (contribution: GoalContribution) => void;
}) {
  const reached = goal.isReached;

  return (
    <Card className="relative overflow-hidden">
      {reached ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-emerald-500/10 blur-3xl"
        />
      ) : null}
      <CardContent className="relative space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span
            className={
              reached
                ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            }
          >
            <Flag aria-hidden="true" className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{goal.name}</p>
              {reached ? (
                <Badge variant="success" className="px-1.5 py-0 text-[9px]">
                  Reached
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground">
              {goal.targetDate ? (
                <>
                  <CalendarDays aria-hidden="true" className="size-3" />
                  <span>Target {formatDateOnlyLabel(goal.targetDate, locale)}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span>
                {goal.contributionCount} contribution{goal.contributionCount === 1 ? "" : "s"}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={onEdit}
              aria-label={`Edit ${goal.name}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label={`Delete ${goal.name}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold tabular-nums">
              {formatMinor(goal.savedMinor, currency, locale)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              of {formatMinor(goal.targetAmountMinor, currency, locale)}
            </span>
          </div>
          <ProgressBar
            value={goal.progressPercent}
            tone={reached ? "emerald" : "violet"}
            className="h-2"
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{goal.progressPercent.toFixed(1)}% funded</span>
            <span>
              {reached
                ? `${formatMinor(
                    (BigInt(goal.savedMinor) - BigInt(goal.targetAmountMinor)).toString(),
                    currency,
                    locale,
                  )} over target`
                : `${formatMinor(goal.remainingMinor, currency, locale)} to go`}
            </span>
          </div>
        </div>

        {goal.notes ? (
          <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            {goal.notes}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={onContribute} className="flex-1 sm:flex-none">
            <Plus aria-hidden="true" />
            Add money
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleHistory}>
            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onArchive}
            disabled={archiving}
          >
            <Archive aria-hidden="true" />
            {archiving ? "Archiving…" : "Archive"}
          </Button>
        </div>

        {expanded ? (
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            {!contributions || contributions.isPending ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1].map((row) => (
                  <div key={row} className="flex items-center gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : contributions.isError ? (
              <QueryError
                error={contributions.error}
                onRetry={() => void contributions.refetch()}
                isRetrying={contributions.isFetching}
                title="History could not be loaded"
                className="border-0 bg-transparent px-2 py-4"
              />
            ) : contributions.data.contributions.length === 0 ? (
              <p className="py-1 text-center text-[11px] text-muted-foreground">
                No contributions yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {contributions.data.contributions.map((contribution) => (
                  <li key={contribution.id} className="flex items-center gap-2 text-[11px]">
                    <History aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                    <span className="w-20 shrink-0 text-muted-foreground">
                      {formatDateOnlyLabel(contribution.occurredAt, locale)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {contribution.note ?? "Contribution"}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatMinor(contribution.amountMinor, currency, locale)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteContribution(contribution)}
                      aria-label={`Delete contribution from ${formatDateOnlyLabel(contribution.occurredAt, locale)}`}
                    >
                      <Trash2 aria-hidden="true" className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
