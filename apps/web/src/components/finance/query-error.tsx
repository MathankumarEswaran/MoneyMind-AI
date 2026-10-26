import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeFinanceError } from "@/lib/finance";
import { cn } from "@/lib/utils";

/** Inline failure panel with a retry affordance, shared by all finance pages. */
export function QueryError({
  error,
  onRetry,
  isRetrying,
  title = "Something went wrong",
  fallback = "The data could not be loaded.",
  className,
}: {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
  title?: string;
  fallback?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/[0.04] px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-1 text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs leading-5 text-muted-foreground">
        {describeFinanceError(error, fallback)}
      </p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onRetry} disabled={isRetrying}>
        <RefreshCw aria-hidden="true" className={cn(isRetrying && "animate-spin")} />
        Try again
      </Button>
    </div>
  );
}
