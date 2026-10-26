import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CircleCheck,
  Clock,
  Database,
  RefreshCw,
  Server,
  Waypoints,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatUptime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function ApiStatus() {
  const { data, isPending, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["system", "health"],
    queryFn: async () => {
      const startedAt = performance.now();
      const health = await api.health();
      return { health, latencyMs: Math.max(1, Math.round(performance.now() - startedAt)) };
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const readyQuery = useQuery({
    queryKey: ["system", "ready"],
    queryFn: api.ready,
    refetchInterval: 30_000,
    retry: 1,
  });

  const databaseUp = readyQuery.data?.data.checks.database === "up";
  const apiError =
    error instanceof ApiClientError
      ? error
      : error
        ? new ApiClientError("The API health check failed unexpectedly.", {
            status: 0,
            code: "UNKNOWN",
            cause: error,
          })
        : null;

  const isUnreachable = apiError?.status === 0 || [502, 503, 504].includes(apiError?.status ?? 0);
  const errorMessage =
    isUnreachable && !apiError?.requestId
      ? "The API is unavailable right now. It may be starting up."
      : (apiError?.message ?? "The health request failed.");

  return (
    <section
      aria-labelledby="system-status-title"
      className="flex h-full flex-col rounded-2xl border border-border/80 bg-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-5">
        <div>
          <h2 id="system-status-title" className="text-sm font-semibold tracking-tight">
            System status
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Live checks against the MoneyMind API
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh system status"
          title="Refresh system status"
        >
          <RefreshCw aria-hidden="true" className={cn(isFetching && "animate-spin")} />
        </Button>
      </div>

      <div className="flex-1 p-5" aria-live="polite">
        {isPending ? (
          <div className="space-y-4">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-36" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
            <p className="pt-1 text-[10px] text-muted-foreground">Checking the API…</p>
          </div>
        ) : isError || !data ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-6 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle aria-hidden="true" className="size-4" />
            </span>
            <p className="mt-3 text-xs font-semibold">API unreachable</p>
            <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-muted-foreground">
              {errorMessage}
            </p>
            {apiError?.requestId ? (
              <p className="mt-1 font-mono text-[9px] break-all text-muted-foreground/70">
                req {apiError.requestId}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw aria-hidden="true" className={cn(isFetching && "animate-spin")} />
              Retry
            </Button>
            <p className="mt-3 text-[9px] text-muted-foreground">
              Is the API running on port 4000?
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <StatusRow
              icon={Server}
              title="API"
              detail={`v${data.health.data.version} · ${data.health.data.environment} · up ${formatUptime(
                data.health.data.uptimeSeconds,
              )}`}
              status="operational"
              latency={`${data.latencyMs} ms`}
            />
            <StatusRow
              icon={Database}
              title="PostgreSQL"
              detail={
                readyQuery.isPending
                  ? "Checking the database…"
                  : databaseUp
                    ? "Connected · migrations applied"
                    : "Database unreachable"
              }
              status={readyQuery.isPending ? "planned" : databaseUp ? "operational" : "offline"}
              latency={databaseUp ? "ready" : undefined}
              hint={readyQuery.isPending ? "Checking" : "Offline"}
            />
            <StatusRow
              icon={Waypoints}
              title="Qdrant"
              detail="Vector collections arrive in Phase 5"
              status="planned"
              hint="Phase 5"
            />

            <div className="flex items-center gap-1.5 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
              <Clock aria-hidden="true" className="size-3" />
              Checked{" "}
              {dataUpdatedAt
                ? new Date(dataUpdatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "just now"}
              <span className="ml-auto">auto-refresh 30s</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface StatusRowProps {
  icon: typeof Server;
  title: string;
  detail: string;
  status: "operational" | "offline" | "planned";
  latency?: string;
  hint?: string;
}

function StatusRow({ icon: Icon, title, detail, status, latency, hint }: StatusRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          status === "operational"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground/60",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium">{title}</p>
          {status === "operational" ? (
            <CircleCheck aria-hidden="true" className="size-3 text-emerald-500" />
          ) : null}
        </div>
        <p className="truncate text-[10px] text-muted-foreground">{detail}</p>
      </div>
      {status === "operational" ? (
        <div className="text-right">
          <Badge variant="success" className="px-1.5 py-0 text-[8px]">
            Online
          </Badge>
          {latency ? (
            <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">{latency}</p>
          ) : null}
        </div>
      ) : (
        <Badge
          variant={status === "offline" ? "destructive" : "outline"}
          className="px-1.5 py-0 text-[8px]"
        >
          {hint}
        </Badge>
      )}
    </div>
  );
}
