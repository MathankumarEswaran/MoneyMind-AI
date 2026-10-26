import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Target, Trash2, TrendingDown, type LucideIcon } from "lucide-react";
import type { Budget } from "@moneymind/shared";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLoading } from "@/components/auth/auth-loading";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BudgetDialog } from "@/components/finance/budget-dialog";
import { CategoryIcon } from "@/components/finance/category-icon";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { PageHeader } from "@/components/finance/page-header";
import { BudgetStatusBadge, ProgressBar } from "@/components/finance/progress";
import { QueryError } from "@/components/finance/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api";
import { formatMinor, formatMonthLabel, thisMonth } from "@/lib/finance";
import { useAuth } from "@/providers/auth-provider";

export default function BudgetsPage() {
  usePageTitle("Budgets");
  const { user } = useAuth();

  if (!user) {
    return <AuthLoading label="Loading your budgets…" />;
  }

  return (
    <AppShell>
      <BudgetsView
        currency={user.workspace.baseCurrency}
        timezone={user.timezone}
        locale={user.locale}
      />
    </AppShell>
  );
}

function BudgetsView({
  currency,
  timezone,
  locale,
}: {
  currency: string;
  timezone: string;
  locale: string;
}) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => thisMonth(timezone));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);

  const budgetsQuery = useQuery({
    queryKey: ["finance", "budgets", month],
    queryFn: () => api.budgets(month),
  });

  const categoriesQuery = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => api.categories(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBudget(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });

  const data = budgetsQuery.data;
  const budgets = useMemo(
    () => [...(data?.budgets ?? [])].sort((a, b) => b.progressPercent - a.progressPercent),
    [data],
  );
  const categories = categoriesQuery.data ?? [];
  const totals = data?.totals ?? {
    budgetedMinor: "0",
    spentMinor: "0",
    remainingMinor: "0",
  };

  const overallProgress =
    BigInt(totals.budgetedMinor) > 0n
      ? Number((BigInt(totals.spentMinor) * 1000n) / BigInt(totals.budgetedMinor)) / 10
      : 0;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setFormOpen(true);
  };

  const dialogCategories = categories.filter((category) => {
    if (category.kind !== "EXPENSE") return false;
    if (editing && editing.category.id === category.id) return true;
    return !budgets.some((budget) => budget.category.id === category.id);
  });

  const overspent = BigInt(totals.remainingMinor) < 0n;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 3 · Core finance"
        title="Budgets"
        description="Give each expense category a monthly envelope. Spending is tracked live from every transaction."
        actions={
          <>
            <MonthSwitcher month={month} onChange={setMonth} locale={locale} />
            <Button size="sm" onClick={openCreate} disabled={categoriesQuery.isPending}>
              <Plus aria-hidden="true" />
              New budget
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] to-card">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-14 -right-14 size-40 rounded-full bg-primary/10 blur-3xl"
          />
          <CardHeader className="relative">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{formatMonthLabel(month, locale)}</CardTitle>
              <Badge variant="outline">{budgets.length} envelopes</Badge>
            </div>
            <CardDescription>
              {formatMinor(totals.spentMinor, currency, locale)} spent of{" "}
              {formatMinor(totals.budgetedMinor, currency, locale)} budgeted.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-2">
            <ProgressBar
              value={overallProgress}
              className="h-2"
              status={
                overallProgress >= 100 ? "OVER" : overallProgress >= 80 ? "NEAR_LIMIT" : "ON_TRACK"
              }
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{overallProgress.toFixed(1)}% used</span>
              <span
                className={
                  overspent ? "font-medium text-rose-600 dark:text-rose-400" : "font-medium"
                }
              >
                {overspent ? "Over by " : "Remaining "}
                {formatMinor(
                  overspent
                    ? (BigInt(totals.remainingMinor) * -1n).toString()
                    : totals.remainingMinor,
                  currency,
                  locale,
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <SummaryTile
          label="Budgeted"
          value={formatMinor(totals.budgetedMinor, currency, locale)}
          hint="Across all envelopes"
          icon={Target}
        />
        <SummaryTile
          label="Spent"
          value={formatMinor(totals.spentMinor, currency, locale)}
          hint="Live from transactions"
          icon={TrendingDown}
        />
      </div>

      {budgetsQuery.isPending ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="ml-auto h-3 w-20" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : budgetsQuery.isError ? (
        <QueryError
          error={budgetsQuery.error}
          onRetry={() => void budgetsQuery.refetch()}
          isRetrying={budgetsQuery.isFetching}
          title="Budgets could not be loaded"
          className="py-16"
        />
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={Target}
              title={`No budgets for ${formatMonthLabel(month, locale)}`}
              description="Pick an expense category and set a limit. Progress updates automatically as transactions land."
              className="min-h-[220px]"
              action={
                <Button size="sm" onClick={openCreate} disabled={categoriesQuery.isPending}>
                  <Plus aria-hidden="true" />
                  Create budget
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {budgets.map((budget) => {
                const remaining = BigInt(budget.remainingMinor);
                const over = remaining < 0n;

                return (
                  <li key={budget.id} className="px-4 py-4 sm:px-5">
                    <div className="flex items-center gap-3">
                      <CategoryIcon icon={budget.category.icon} color={budget.category.color} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{budget.category.name}</p>
                          <BudgetStatusBadge status={budget.status} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatMinor(budget.spentMinor, currency, locale)} of{" "}
                          {formatMinor(budget.amountMinor, currency, locale)}
                        </p>
                      </div>

                      <div className="hidden text-right sm:block">
                        <p className="text-xs font-semibold tabular-nums">
                          {budget.progressPercent.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {over ? "over" : "used"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => openEdit(budget)}
                          aria-label={`Edit ${budget.category.name} budget`}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleting(budget)}
                          aria-label={`Delete ${budget.category.name} budget`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 sm:pl-11">
                      <ProgressBar value={budget.progressPercent} status={budget.status} />
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {over
                            ? `Over by ${formatMinor((remaining * -1n).toString(), currency, locale)}`
                            : `${formatMinor(budget.remainingMinor, currency, locale)} remaining`}
                        </span>
                        <span>{budget.progressPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <BudgetDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        budget={editing}
        categories={dialogCategories}
        currency={currency}
        month={month}
        locale={locale}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteMutation.mutateAsync(deleting.id);
        }}
        title="Delete budget?"
        description={
          deleting
            ? `The ${deleting.category.name} envelope for ${formatMonthLabel(deleting.month, locale)} will be removed. Transactions stay untouched.`
            : ""
        }
        confirmLabel="Delete budget"
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {label}
          </p>
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
            <Icon aria-hidden="true" className="size-3.5" />
          </span>
        </div>
        <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
