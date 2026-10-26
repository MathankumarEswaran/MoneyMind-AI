import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import type { CategoryKind, Transaction } from "@moneymind/shared";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLoading } from "@/components/auth/auth-loading";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CategoryIcon } from "@/components/finance/category-icon";
import { MonthSwitcher } from "@/components/finance/month-switcher";
import { PageHeader } from "@/components/finance/page-header";
import { QueryError } from "@/components/finance/query-error";
import { TransactionDialog } from "@/components/finance/transaction-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { api, type TransactionQuery } from "@/lib/api";
import { formatDateLabel, formatMinor, monthBounds, signedAmount, thisMonth } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  usePageTitle("Transactions");
  const { user } = useAuth();

  if (!user) {
    return <AuthLoading label="Loading your transactions…" />;
  }

  return (
    <AppShell>
      <TransactionsView
        currency={user.workspace.baseCurrency}
        timezone={user.timezone}
        locale={user.locale}
      />
    </AppShell>
  );
}

function TransactionsView({
  currency,
  timezone,
  locale,
}: {
  currency: string;
  timezone: string;
  locale: string;
}) {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<"ALL" | CategoryKind>("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(() => thisMonth(timezone));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const categoriesQuery = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => api.categories(),
  });

  const query: TransactionQuery = {
    q: q || undefined,
    type: type === "ALL" ? undefined : type,
    categoryId: categoryId === "ALL" ? undefined : categoryId,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: PAGE_SIZE,
    order,
  };

  const transactionsQuery = useQuery({
    queryKey: ["finance", "transactions", query],
    queryFn: () => api.transactions(query),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });

  const categories = categoriesQuery.data ?? [];
  const transactions = transactionsQuery.data?.data.transactions ?? [];
  const meta = transactionsQuery.data?.meta;
  const totals = meta?.totals ?? { incomeMinor: "0", expensesMinor: "0", netMinor: "0" };
  const filtersActive =
    Boolean(q) || type !== "ALL" || categoryId !== "ALL" || Boolean(from) || Boolean(to);

  const resetPage = () => setPage(1);

  const clearFilters = () => {
    setSearchInput("");
    setQ("");
    setType("ALL");
    setCategoryId("ALL");
    setFrom("");
    setTo("");
    setOrder("desc");
    setPage(1);
  };

  const applyMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    const bounds = monthBounds(nextMonth);
    setFrom(bounds.from);
    setTo(bounds.to);
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction);
    setFormOpen(true);
  };

  const firstRow = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const lastRow = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 3 · Core finance"
        title="Transactions"
        description="Every income and expense in one ledger. Search, filter by date or category, and keep your records tidy."
        actions={
          <>
            <MonthSwitcher month={month} onChange={applyMonth} locale={locale} />
            <Button size="sm" onClick={openCreate} disabled={categoriesQuery.isPending}>
              <Plus aria-hidden="true" />
              Add transaction
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Income"
          value={formatMinor(totals.incomeMinor, currency, locale)}
          hint={filtersActive ? "Matching your filters" : "All recorded income"}
          icon={TrendingUp}
          index={0}
        />
        <StatCard
          label="Expenses"
          value={formatMinor(totals.expensesMinor, currency, locale)}
          hint={filtersActive ? "Matching your filters" : "All recorded spending"}
          icon={TrendingDown}
          index={1}
        />
        <StatCard
          label="Net"
          value={formatMinor(totals.netMinor, currency, locale)}
          hint="Income minus expenses"
          icon={Wallet}
          index={2}
        />
        <StatCard
          label="Matches"
          value={meta ? String(meta.total) : "—"}
          hint={`${PAGE_SIZE} per page`}
          icon={ReceiptText}
          index={3}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search description, merchant, notes or category…"
              aria-label="Search transactions"
              className="pl-9"
            />
            {searchInput ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
              >
                <X aria-hidden="true" />
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value as "ALL" | CategoryKind);
                resetPage();
              }}
              aria-label="Filter by type"
            >
              <option value="ALL">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expenses</option>
            </Select>

            <Select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                resetPage();
              }}
              aria-label="Filter by category"
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>

            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
              aria-label="From date"
            />

            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
              aria-label="To date"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              {filtersActive ? "Filtered view" : "All transactions"}
            </Badge>

            <Button variant="ghost" size="sm" onClick={() => applyMonth(thisMonth(timezone))}>
              This month
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOrder((current) => (current === "desc" ? "asc" : "desc"));
                setPage(1);
              }}
            >
              {order === "desc" ? (
                <ArrowDownWideNarrow aria-hidden="true" />
              ) : (
                <ArrowUpNarrowWide aria-hidden="true" />
              )}
              {order === "desc" ? "Newest first" : "Oldest first"}
            </Button>

            {filtersActive || from || to ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={clearFilters}
              >
                <X aria-hidden="true" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {transactionsQuery.isPending ? (
            <TransactionSkeleton />
          ) : transactionsQuery.isError ? (
            <div className="p-4 sm:p-5">
              <QueryError
                error={transactionsQuery.error}
                onRetry={() => void transactionsQuery.refetch()}
                isRetrying={transactionsQuery.isFetching}
                title="Transactions could not be loaded"
              />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={ReceiptText}
                title={filtersActive ? "No matching transactions" : "No transactions yet"}
                description={
                  filtersActive
                    ? "Try a broader search or clear the filters to see everything."
                    : "Add your first income or expense to start building a picture of your cash flow."
                }
                action={
                  filtersActive ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button size="sm" onClick={openCreate}>
                      <Plus aria-hidden="true" />
                      Add transaction
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {transactions.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30 sm:px-5"
                >
                  <CategoryIcon
                    icon={transaction.category?.icon}
                    color={transaction.category?.color}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{transaction.description}</p>
                      {transaction.notes ? (
                        <Badge
                          variant="outline"
                          className="hidden px-1.5 py-0 text-[9px] sm:inline-flex"
                        >
                          Note
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      <span>{transaction.category?.name ?? "Uncategorized"}</span>
                      {transaction.merchant ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{transaction.merchant}</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span>{formatDateLabel(transaction.occurredAt, timezone, locale)}</span>
                    </p>
                  </div>

                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      transaction.type === "INCOME"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground",
                    )}
                  >
                    {signedAmount(transaction.type, transaction.amountMinor, currency, locale)}
                  </p>

                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      onClick={() => openEdit(transaction)}
                      aria-label={`Edit ${transaction.description}`}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(transaction)}
                      aria-label={`Delete ${transaction.description}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {meta && meta.total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-[11px] text-muted-foreground">
            Showing {firstRow}–{lastRow} of {meta.total} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={meta.page <= 1 || transactionsQuery.isFetching}
            >
              Previous
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Page {meta.page} of {Math.max(meta.totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={meta.page >= meta.totalPages || transactionsQuery.isFetching}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <TransactionDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        transaction={editing}
        categories={categories}
        currency={currency}
        timezone={timezone}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteMutation.mutateAsync(deleting.id);
        }}
        title="Delete transaction?"
        description={
          deleting
            ? `“${deleting.description}” will be removed from your ledger and all totals.`
            : ""
        }
        confirmLabel="Delete transaction"
      />
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div className="divide-y divide-border/60" aria-busy="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-56" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
