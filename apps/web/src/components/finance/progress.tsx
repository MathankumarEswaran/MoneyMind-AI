import type { BudgetStatus } from "@moneymind/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<
  BudgetStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  ON_TRACK: { label: "On track", variant: "success" },
  NEAR_LIMIT: { label: "Near limit", variant: "warning" },
  OVER: { label: "Over budget", variant: "destructive" },
};

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const copy = STATUS_COPY[status];

  return (
    <Badge variant={copy.variant} className="shrink-0">
      {copy.label}
    </Badge>
  );
}

const BAR_COLORS: Record<BudgetStatus, string> = {
  ON_TRACK: "bg-emerald-500",
  NEAR_LIMIT: "bg-amber-500",
  OVER: "bg-rose-500",
};

export function ProgressBar({
  value,
  status = "ON_TRACK",
  className,
  tone,
}: {
  value: number;
  status?: BudgetStatus;
  className?: string;
  tone?: "emerald" | "sky" | "violet";
}) {
  const width = Math.max(0, Math.min(value, 100));
  const color = tone
    ? { emerald: "bg-emerald-500", sky: "bg-sky-500", violet: "bg-violet-500" }[tone]
    : BAR_COLORS[status];

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border/70", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", color)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
