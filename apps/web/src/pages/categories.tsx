import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import type { Category, CategoryKind } from "@moneymind/shared";
import { AppShell } from "@/components/layout/app-shell";
import { AuthLoading } from "@/components/auth/auth-loading";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CategoryDialog } from "@/components/finance/category-dialog";
import { CategoryIcon } from "@/components/finance/category-icon";
import { PageHeader } from "@/components/finance/page-header";
import { QueryError } from "@/components/finance/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

export default function CategoriesPage() {
  usePageTitle("Categories");
  const { user } = useAuth();

  if (!user) {
    return <AuthLoading label="Loading your categories…" />;
  }

  return (
    <AppShell>
      <CategoriesView />
    </AppShell>
  );
}

function CategoriesView() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [defaultKind, setDefaultKind] = useState<CategoryKind>("EXPENSE");
  const [deleting, setDeleting] = useState<Category | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: () => api.categories(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });

  const categories = categoriesQuery.data ?? [];
  const income = categories.filter((category) => category.kind === "INCOME");
  const expenses = categories.filter((category) => category.kind === "EXPENSE");

  const openCreate = (kind: CategoryKind) => {
    setEditing(null);
    setDefaultKind(kind);
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setDefaultKind(category.kind);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 3 · Core finance"
        title="Categories"
        description="Categories power budgets, breakdowns and trends. Rename the starters, recolour them, or add your own."
        actions={
          <Button size="sm" onClick={() => openCreate("EXPENSE")}>
            <Plus aria-hidden="true" />
            New category
          </Button>
        }
      />

      {categoriesQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((column) => (
            <Card key={column}>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-lg" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : categoriesQuery.isError ? (
        <QueryError
          error={categoriesQuery.error}
          onRetry={() => void categoriesQuery.refetch()}
          isRetrying={categoriesQuery.isFetching}
          title="Categories could not be loaded"
          className="py-16"
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <CategoryColumn
            title="Expense categories"
            description="Where your spending is grouped. Budgets are built on these."
            kind="EXPENSE"
            categories={expenses}
            onCreate={() => openCreate("EXPENSE")}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
          <CategoryColumn
            title="Income categories"
            description="Where incoming money is grouped, from salary to side projects."
            kind="INCOME"
            categories={income}
            onCreate={() => openCreate("INCOME")}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        </div>
      )}

      <CategoryDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        category={editing}
        defaultKind={defaultKind}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteMutation.mutateAsync(deleting.id);
        }}
        title="Delete category?"
        description={
          deleting
            ? `“${deleting.name}” will be removed. Categories with transactions or budgets cannot be deleted.`
            : ""
        }
        confirmLabel="Delete category"
        fallback="This category could not be deleted."
      />
    </div>
  );
}

function CategoryColumn({
  title,
  description,
  kind,
  categories,
  onCreate,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  kind: CategoryKind;
  categories: Category[];
  onCreate: () => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {categories.length}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        {categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={`No ${kind === "INCOME" ? "income" : "expense"} categories`}
            description="Add one to start grouping your transactions."
            action={
              <Button variant="outline" size="sm" onClick={onCreate}>
                <Plus aria-hidden="true" />
                Add category
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <CategoryIcon icon={category.icon} color={category.color} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-xs font-medium">{category.name}</p>
                    {category.isSystem ? (
                      <Badge variant="outline" className="px-1.5 py-0 text-[8px]">
                        Starter
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {category.transactionCount === 0
                      ? "No transactions yet"
                      : `${category.transactionCount} transaction${category.transactionCount === 1 ? "" : "s"}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    onClick={() => onEdit(category)}
                    aria-label={`Edit ${category.name}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  {category.isSystem ? (
                    <span
                      className="flex size-8 items-center justify-center text-muted-foreground/40"
                      title="Starter categories can be renamed but not deleted"
                    >
                      <LockKeyhole aria-hidden="true" className="size-3.5" />
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(category)}
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
