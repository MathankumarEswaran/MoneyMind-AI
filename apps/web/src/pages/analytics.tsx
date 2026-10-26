import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn, ChartPie, Store, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLoading } from "@/components/auth/auth-loading";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashFlowChart } from "@/components/finance/cash-flow-chart";
import { DonutChart } from "@/components/finance/donut-chart";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { PageHeader } from "@/components/finance/page-header";
import { ProgressBar } from "@/components/finance/progress";
import { QueryError } from "@/components/finance/query-error";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api";
import { formatMinor, formatPercent, formatMonthLabel, thisMonth } from "@/lib/finance";
import { useAuth } from "@/providers/auth-provider";

const RANGES = [3, 6, 12, 24] as const;

export default function AnalyticsPage() {
  usePageTitle("Analytics");
  const { user } = useAuth();

  if (!user) {
    return <AuthLoading label="Loading your analytics…" />;
  }

  return (
    <AppShell>
      <AnalyticsView
        currency={user.workspace.baseCurrency}
        timezone={user.timezone}
        locale={user.locale}
      />
    </AppShell>
  );
}

function AnalyticsView({
  currency,
  timezone,
  locale,
}: {
  currency: string;
  timezone: string;
  locale: string;
}) {
  const [month, setMonth] = useState(() => thisMonth(timezone));
  const [months, setMonths] = useState<number>(12);

  const analyticsQuery = useQuery({
    queryKey: ["finance", "analytics", month, months],
    queryFn: () => api.analytics(month, months),
    placeholderData: (previous) => previous,
  });

  const data = analyticsQuery.data;
  const totals = data?.totals ?? {
    incomeMinor: "0",
    expensesMinor: "0",
    netMinor: "0",
    savingsRate: null,
    transactionCount: 0,
  };
  const breakdown = data?.categoryBreakdown ?? [];
  const trend = data?.trend ?? [];
  const merchants = data?.topMerchants ?? [];

  const biggest = breakdown[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 3 · Core finance"
        title="Analytics"
        description="Where the money comes from, where it goes, and how the picture changes month over month."
        actions={
          <>
            <MonthSwitcher month={month} onChange={setMonth} locale={locale} />
            <Select
              value={String(months)}
              onChange={(event) => setMonths(Number(event.target.value))}
              aria-label="Trend range"
              className="w-auto"
            >
              {RANGES.map((range) => (
                <option key={range} value={range}>
                  Last {range} months
                </option>
              ))}
            </Select>
          </>
        }
      />

      {analyticsQuery.isError ? (
        <QueryError
          error={analyticsQuery.error}
          onRetry={() => void analyticsQuery.refetch()}
          isRetrying={analyticsQuery.isFetching}
          title="Analytics could not be loaded"
          className="py-16"
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Income"
              value={formatMinor(totals.incomeMinor, currency, locale)}
              hint={formatMonthLabel(month, locale)}
              icon={TrendingUp}
              index={0}
            />
            <StatCard
              label="Spending"
              value={formatMinor(totals.expensesMinor, currency, locale)}
              hint={formatMonthLabel(month, locale)}
              icon={TrendingDown}
              index={1}
            />
            <StatCard
              label="Net cash flow"
              value={formatMinor(totals.netMinor, currency, locale)}
              hint={`${totals.transactionCount} transaction${totals.transactionCount === 1 ? "" : "s"}`}
              icon={Wallet}
              index={2}
            />
            <StatCard
              label="Savings rate"
              value={formatPercent(totals.savingsRate)}
              hint={totals.savingsRate === null ? "Add income to calculate" : "Of income kept"}
              icon={ChartPie}
              index={3}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Cash flow</CardTitle>
                  <CardDescription>
                    Income and spending across the last {months} months
                  </CardDescription>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {trend.length} months
                </Badge>
              </CardHeader>
              <CardContent>
                {analyticsQuery.isPending ? (
                  <div className="space-y-3" aria-busy="true">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-44 w-full rounded-xl" />
                  </div>
                ) : trend.length === 0 ? (
                  <EmptyState
                    icon={ChartColumn}
                    title="No trend yet"
                    description="Add transactions to see how income and spending move over time."
                    className="min-h-[220px]"
                  />
                ) : (
                  <CashFlowChart points={trend} currency={currency} locale={locale} />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Spending mix</CardTitle>
                <CardDescription>{formatMonthLabel(month, locale)}</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsQuery.isPending ? (
                  <div className="flex items-center gap-4" aria-busy="true">
                    <Skeleton className="size-40 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ) : breakdown.length === 0 ? (
                  <EmptyState
                    icon={ChartPie}
                    title="No spending yet"
                    description="Expenses in this month will appear here grouped by category."
                    className="min-h-[220px]"
                  />
                ) : (
                  <DonutChart
                    items={breakdown}
                    currency={currency}
                    locale={locale}
                    centerLabel="total spent"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Category breakdown</CardTitle>
                  <CardDescription>Every expense category for the selected month</CardDescription>
                </div>
                {biggest ? (
                  <Badge variant="outline" className="shrink-0">
                    Top: {biggest.name}
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent>
                {analyticsQuery.isPending ? (
                  <div className="space-y-3" aria-busy="true">
                    {[0, 1, 2, 3].map((row) => (
                      <div key={row} className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-1.5 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : breakdown.length === 0 ? (
                  <EmptyState
                    icon={ChartPie}
                    title="Nothing to break down"
                    description="Record an expense to see category shares and the largest drivers of spending."
                    className="min-h-[180px]"
                  />
                ) : (
                  <ul className="space-y-3">
                    {breakdown.map((item) => (
                      <li key={item.categoryId ?? "uncategorized"} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color ?? "#94a3b8" }}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {item.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {item.sharePercent.toFixed(1)}%
                          </span>
                          <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">
                            {formatMinor(item.amountMinor, currency, locale)}
                          </span>
                        </div>
                        <ProgressBar value={item.sharePercent} className="h-1" tone="sky" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top merchants</CardTitle>
                <CardDescription>Largest spending destinations this month</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsQuery.isPending ? (
                  <div className="space-y-3" aria-busy="true">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="flex items-center gap-2">
                        <Skeleton className="size-8 rounded-lg" />
                        <Skeleton className="h-3 flex-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                ) : merchants.length === 0 ? (
                  <EmptyState
                    icon={Store}
                    title="No merchants yet"
                    description="Add a merchant when recording an expense to rank who gets the most of your money."
                    className="min-h-[180px]"
                  />
                ) : (
                  <ul className="divide-y divide-border/60">
                    {merchants.map((merchant) => (
                      <li
                        key={merchant.merchant}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Store aria-hidden="true" className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{merchant.merchant}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {merchant.count} transaction{merchant.count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-medium tabular-nums">
                          {formatMinor(merchant.amountMinor, currency, locale)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
