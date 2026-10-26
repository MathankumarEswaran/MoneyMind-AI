import type { Category, CategoryKind } from "@moneymind/shared";

export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  sortOrder: number;
}> = [
  { name: "Salary", kind: "INCOME", color: "#10b981", icon: "briefcase", sortOrder: 10 },
  { name: "Freelance", kind: "INCOME", color: "#14b8a6", icon: "laptop", sortOrder: 20 },
  { name: "Investments", kind: "INCOME", color: "#0ea5e9", icon: "trending-up", sortOrder: 30 },
  { name: "Other Income", kind: "INCOME", color: "#64748b", icon: "plus-circle", sortOrder: 40 },
  { name: "Housing", kind: "EXPENSE", color: "#6366f1", icon: "home", sortOrder: 10 },
  { name: "Groceries", kind: "EXPENSE", color: "#22c55e", icon: "shopping-basket", sortOrder: 20 },
  { name: "Transport", kind: "EXPENSE", color: "#f59e0b", icon: "bus", sortOrder: 30 },
  { name: "Utilities", kind: "EXPENSE", color: "#06b6d4", icon: "plug", sortOrder: 40 },
  { name: "Dining", kind: "EXPENSE", color: "#ef4444", icon: "utensils", sortOrder: 50 },
  { name: "Shopping", kind: "EXPENSE", color: "#ec4899", icon: "shopping-bag", sortOrder: 60 },
  { name: "Health", kind: "EXPENSE", color: "#f43f5e", icon: "heart-pulse", sortOrder: 70 },
  { name: "Entertainment", kind: "EXPENSE", color: "#a855f7", icon: "clapperboard", sortOrder: 80 },
  { name: "Education", kind: "EXPENSE", color: "#3b82f6", icon: "graduation-cap", sortOrder: 90 },
  { name: "Travel", kind: "EXPENSE", color: "#0ea5e9", icon: "plane", sortOrder: 100 },
  { name: "Subscriptions", kind: "EXPENSE", color: "#8b5cf6", icon: "repeat", sortOrder: 110 },
  {
    name: "Other Expense",
    kind: "EXPENSE",
    color: "#64748b",
    icon: "circle-dashed",
    sortOrder: 120,
  },
];

/** Placeholder category used in breakdowns for transactions without one. */
export const UNCATEGORIZED = {
  id: null,
  name: "Uncategorized",
  color: "#94a3b8",
  icon: "circle-help",
} as const;

export type CategoryRecord = {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryRow = CategoryRecord & { _count: { transactions: number } };

export function toCategoryRef(row: {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    color: row.color,
    icon: row.icon,
  };
}

export type CategoryDto = Category;

export function toCategory(row: CategoryRow): Category {
  return {
    ...toCategoryRef(row),
    isSystem: row.isSystem,
    transactionCount: row._count.transactions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
