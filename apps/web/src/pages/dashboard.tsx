import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  ChartColumn,
  ChartPie,
  Flag,
  Lightbulb,
  Plus,
  ReceiptText,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLoading } from "@/components/auth/auth-loading";
import { ApiStatus } from "@/components/dashboard/api-status";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashFlowChart } from "@/components/finance/cash-flow-chart";
import { CategoryIcon } from "@/components/finance/category-icon";
import { DonutChart } from "@/components/finance/donut-chart";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { ProgressBar } from "@/components/finance/progress";
import { QueryError } from "@/components/finance/query-error";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { PageHeader } from "@/components/finance/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api";
import {
  formatDateLabel,
  formatMinor,
  formatMonthLabel,
  formatPercent,
  formatSignedPercent,
  signedAmount,
  thisMonth,
} from "@/lib/finance";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const { user } = useAuth();

  if (!user) {
    return <AuthLoading label="Loading your dashboard…" />;
  }

  return (
    <AppShell>
      <DashboardView
        name={user.name}
        currency={user.workspace.baseCurrency}
        timezone={user.timezone}
        locale={user.locale}
      />
    </AppShell>
  );
}

function DashboardView({
  name,
  currency,
  timezone,
  locale,
}: {
  name: string;
  currency: string;
  timezone: string;
  locale: string;
}) {
  const [month, setMonth] = useState(() => thisMonth(timezone));
  const [formOpen, setFormOpen] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ["finance", "dashboard", month],
    queryFn: () => api.dashboard(month),
    placeholderData: (previous) => previous,
  });

  const categoriesQuery = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => api.categories(),
  });

  const firstName = name.trim().split(/\s+/)[0] ?? "there";
  const data = dashboardQuery.data;
  const categories = categoriesQuery.data ?? [];
  const empty = data?.totals.transactionCount === 0;

  const hintFor = (value: number | null, base: string) =>
    value === null ? `No ${base} last month` : `${formatSignedPercent(value)} vs last month`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 3 · Core finance"
        title={`Welcome back, ${firstName}`}
        description={`Your money at a glance for ${formatMonthLabel(month, locale)}. Add income and expenses to keep every number current.`}
        actions={
          <>
            <MonthSwitcher month={month} onChange={setMonth} locale={locale} />
            <Button
              size="sm"
              onClick={() => setFormOpen(true)}
              disabled={categoriesQuery.isPending}
            >
              <Plus aria-hidden="true" />
              Add transaction
            </Button>
          </>
        }
      />

      {dashboardQuery.isPending ? (
        <DashboardSkeleton />
      ) : dashboardQuery.isError || !data ? (
        <QueryError
          error={dashboardQuery.error}
          onRetry={() => void dashboardQuery.refetch()}
          isRetrying={dashboardQuery.isFetching}
          title="Your dashboard could not be loaded"
          className="py-16"
        />
      ) : (
        <>
          {empty ? (
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.07] via-card to-sky-500/[0.05] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles aria-hidden="true" className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Your ledger is ready</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    Record your first income or expense. Budgets, goals and trends fill in
                    automatically from there.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="self-start sm:self-center"
                  onClick={() => setFormOpen(true)}
                >
                  <Plus aria-hidden="true" />
                  Add transaction
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Income"
              value={formatMinor(data.totals.incomeMinor, currency, locale)}
              hint={hintFor(data.changes.incomePercent, "income")}
              icon={TrendingUp}
              index={0}
            />
            <StatCard
              label="Spending"
              value={formatMinor(data.totals.expensesMinor, currency, locale)}
              hint={hintFor(data.changes.expensesPercent, "spending")}
              icon={TrendingDown}
              index={1}
            />
            <StatCard
              label="Net balance"
              value={formatMinor(data.totals.netMinor, currency, locale)}
              hint={`${data.totals.transactionCount} transaction${data.totals.transactionCount === 1 ? "" : "s"} this month`}
              icon={Wallet}
              index={2}
            />
            <StatCard
              label="Savings rate"
              value={formatPercent(data.totals.savingsRate)}
              hint={
                data.totals.savingsRate === null
                  ? "Add income to calculate"
                  : "Share of income kept"
              }
              icon={ChartPie}
              index={3}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Cash flow</CardTitle>
                  <CardDescription>Income vs. spending, last 6 months</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/analytics">
                    Open analytics
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.trend.some(
                  (point) => point.incomeMinor !== "0" || point.expensesMinor !== "0",
                ) ? (
                  <CashFlowChart points={data.trend} currency={currency} locale={locale} />
                ) : (
                  <EmptyState
                    icon={ChartColumn}
                    title="No cash flow yet"
                    description="Once you record a few transactions, this becomes a six-month view of what came in and what went out."
                    className="min-h-[236px]"
                    action={
                      <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                        <Plus aria-hidden="true" />
                        Add transaction
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Spending mix</CardTitle>
                  <CardDescription>{formatMonthLabel(month, locale)}</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/analytics">
                    Details
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.categoryBreakdown.length === 0 ? (
                  <EmptyState
                    icon={ChartPie}
                    title="No spending yet"
                    description="Expenses will appear here grouped by category."
                    className="min-h-[236px]"
                  />
                ) : (
                  <DonutChart
                    items={data.categoryBreakdown}
                    currency={currency}
                    locale={locale}
                    centerLabel="spent"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-blue-500/5"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="size-5 text-primary" />
                AI Financial Insight
              </CardTitle>
              <CardDescription>Personalized recommendations based on your spending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Lightbulb className="size-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">
                    {data.totals.savingsRate !== null && data.totals.savingsRate > 20
                      ? `Great job! You're saving ${formatPercent(data.totals.savingsRate)} of your income. Keep up the momentum by reviewing your budget categories regularly.`
                      : data.totals.savingsRate !== null && data.totals.savingsRate > 0
                      ? `You're saving ${formatPercent(data.totals.savingsRate)} of your income. Consider automating savings or cutting discretionary spending to reach your financial goals faster.`
                      : data.totals.expensesMinor > data.totals.incomeMinor
                      ? `You're spending more than you earn this month. Review your largest expenses and create budgets for essential categories.`
                      : "Track your expenses consistently to get personalized AI insights. Add more transactions to unlock smarter recommendations."}
                  </p>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link to="/copilot">
                      Ask AI Copilot for detailed advice
                      <ArrowRight aria-hidden="true" className="ml-1 size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Budgets</CardTitle>
                  <CardDescription>Closest to the limit first</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/budgets">
                    View all
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="flex-1">
                {data.budgets.length === 0 ? (
                  <EmptyState
                    icon={Target}
                    title="No budgets yet"
                    description="Set a monthly limit for an expense category and track it live."
                    className="min-h-[170px]"
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link to="/budgets">
                          <Plus aria-hidden="true" />
                          Create a budget
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="space-y-3">
                    {data.budgets.map((budget) => (
                      <li key={budget.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <CategoryIcon
                            icon={budget.category.icon}
                            color={budget.category.color}
                            className="size-7 rounded-lg"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {budget.category.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                            {formatMinor(budget.spentMinor, currency, locale)} /{" "}
                            {formatMinor(budget.amountMinor, currency, locale)}
                          </span>
                        </div>
                        <ProgressBar value={budget.progressPercent} status={budget.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Goals</CardTitle>
                  <CardDescription>Active savings targets</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/goals">
                    View all
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="flex-1">
                {data.goals.length === 0 ? (
                  <EmptyState
                    icon={Flag}
                    title="No active goals"
                    description="Set a savings target and add contributions as you put money aside."
                    className="min-h-[170px]"
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link to="/goals">
                          <Plus aria-hidden="true" />
                          Create a goal
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="space-y-3">
                    {data.goals.map((goal) => (
                      <li key={goal.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Flag aria-hidden="true" className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {goal.name}
                          </span>
                          <Badge
                            variant={goal.isReached ? "success" : "outline"}
                            className="shrink-0 px-1.5 py-0 text-[9px]"
                          >
                            {goal.progressPercent.toFixed(0)}%
                          </Badge>
                        </div>
                        <ProgressBar
                          value={goal.progressPercent}
                          tone={goal.isReached ? "emerald" : "violet"}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Recent transactions</CardTitle>
                  <CardDescription>Latest activity across every month</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/transactions">
                    View ledger
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.recentTransactions.length === 0 ? (
                  <EmptyState
                    icon={ReceiptText}
                    title="No transactions yet"
                    description="Your latest income and expenses will appear here."
                    action={
                      <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                        <Plus aria-hidden="true" />
                        Add transaction
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.recentTransactions.map((transaction) => (
                      <li
                        key={transaction.id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <CategoryIcon
                          icon={transaction.category?.icon}
                          color={transaction.category?.color}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{transaction.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {transaction.category?.name ?? "Uncategorized"} ·{" "}
                            {formatDateLabel(transaction.occurredAt, timezone, locale)}
                          </p>
                        </div>
                        <span
                          className={
                            transaction.type === "INCOME"
                              ? "shrink-0 text-xs font-semibold text-emerald-600 tabular-nums dark:text-emerald-400"
                              : "shrink-0 text-xs font-semibold tabular-nums"
                          }
                        >
                          {signedAmount(
                            transaction.type,
                            transaction.amountMinor,
                            currency,
                            locale,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <ApiStatus />
          </div>
        </>
      )}

      <TransactionDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        categories={categories}
        currency={currency}
        timezone={timezone}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <Card key={card}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="flex items-center gap-4 p-5">
            <Skeleton className="size-40 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <Card key={card}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-24" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
