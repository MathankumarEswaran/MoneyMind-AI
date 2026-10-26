import type { CategoryBreakdownItem } from "@moneymind/shared";
import { formatMinor } from "@/lib/finance";

/**
 * Dependency-free SVG donut. Segments use stroke-dasharray so the chart scales
 * with its container and stays crisp without a charting library.
 */
export function DonutChart({
  items,
  currency,
  locale,
  size = 176,
  thickness = 18,
  centerLabel = "spent",
}: {
  items: CategoryBreakdownItem[];
  currency: string;
  locale: string;
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const total = items.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n);
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="size-full"
          role="img"
          aria-label={`Spending breakdown: ${items.length} categories`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={thickness}
            opacity={0.55}
          />
          {total > 0n
            ? items.map((item) => {
                const share = Number((BigInt(item.amountMinor) * 1000n) / total) / 1000;
                const length = circumference * share;
                const dashOffset = -offset;
                offset += length;

                return (
                  <circle
                    key={item.categoryId ?? "uncategorized"}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={item.color ?? "#94a3b8"}
                    strokeWidth={thickness}
                    strokeLinecap="butt"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${center} ${center})`}
                  />
                );
              })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {centerLabel}
          </span>
          <span className="mt-0.5 text-sm font-semibold tracking-tight">
            {formatMinor(total.toString(), currency, locale, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2">
        {items.length === 0 ? (
          <li className="text-xs text-muted-foreground">No spending recorded for this period.</li>
        ) : (
          items.slice(0, 6).map((item) => (
            <li
              key={item.categoryId ?? "uncategorized"}
              className="flex items-center gap-2.5 text-xs"
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color ?? "#94a3b8" }}
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {item.sharePercent.toFixed(1)}%
              </span>
              <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                {formatMinor(item.amountMinor, currency, locale)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
