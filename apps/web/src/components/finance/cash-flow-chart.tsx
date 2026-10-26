import type { MonthlyPoint } from "@moneymind/shared";
import { formatMinor, formatMonthShort } from "@/lib/finance";

/**
 * CSS bar chart: two bars per month (income, spending). Percent heights keep it
 * fluid at every breakpoint and hover titles expose exact values.
 */
export function CashFlowChart({
  points,
  currency,
  locale,
  compact = false,
}: {
  points: MonthlyPoint[];
  currency: string;
  locale: string;
  compact?: boolean;
}) {
  const max = points.reduce((peak, point) => {
    const income = Number(point.incomeMinor);
    const expenses = Number(point.expensesMinor);
    return Math.max(peak, income, expenses);
  }, 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          Income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rose-500" />
          Spending
        </span>
      </div>

      <div className="flex items-stretch gap-1.5 sm:gap-2.5">
        {points.map((point) => {
          const incomeHeight = max === 0 ? 0 : (Number(point.incomeMinor) / max) * 100;
          const expenseHeight = max === 0 ? 0 : (Number(point.expensesMinor) / max) * 100;

          return (
            <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className={
                  compact
                    ? "flex h-28 w-full items-end justify-center gap-0.5"
                    : "flex h-44 w-full items-end justify-center gap-1"
                }
              >
                <div
                  title={`${formatMonthShort(point.month, locale)} income: ${formatMinor(point.incomeMinor, currency, locale)}`}
                  className="w-full max-w-2.5 rounded-t bg-emerald-500/85 transition-[height] duration-500"
                  style={{ height: `${incomeHeight > 0 ? Math.max(incomeHeight, 2) : 0}%` }}
                />
                <div
                  title={`${formatMonthShort(point.month, locale)} spending: ${formatMinor(point.expensesMinor, currency, locale)}`}
                  className="w-full max-w-2.5 rounded-t bg-rose-500/80 transition-[height] duration-500"
                  style={{ height: `${expenseHeight > 0 ? Math.max(expenseHeight, 2) : 0}%` }}
                />
              </div>
              <span className="truncate text-[9px] text-muted-foreground sm:text-[10px]">
                {formatMonthShort(point.month, locale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
