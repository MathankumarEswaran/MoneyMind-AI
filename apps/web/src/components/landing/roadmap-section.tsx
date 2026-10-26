import { Check, CircleDot, Sparkles } from "lucide-react";
import { PHASES, type PhaseStatus } from "@moneymind/shared";
import { Reveal } from "@/components/motion/reveal";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  PhaseStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]>; dot: string }
> = {
  complete: { label: "Shipped", variant: "success", dot: "bg-emerald-500" },
  active: { label: "In progress", variant: "default", dot: "bg-primary" },
  next: { label: "Next", variant: "outline", dot: "bg-sky-500" },
  planned: { label: "Planned", variant: "secondary", dot: "bg-muted-foreground/50" },
};

const COMPLETED_PHASES = PHASES.filter((phase) => phase.status === "complete").length;
const LATEST_SHIPPED = PHASES.reduce(
  (latest, phase) => (phase.status === "complete" ? Math.max(latest, phase.id) : latest),
  0,
);

const EXIT_CRITERIA = [
  "PostgreSQL with versioned Prisma migrations",
  "User, workspace, membership and session models",
  "Argon2id credentials and validated auth contracts",
  "Rotating refresh tokens with reuse detection",
  "Protected routes, profile and session management",
  "Integration tests across register, login, refresh and logout",
] as const;

export function RoadmapSection() {
  return (
    <section
      id="roadmap"
      className="relative scroll-mt-28 border-y border-border/60 bg-card/25 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline">Build sequence</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-[2.6rem] sm:leading-[1.08]">
              Nine phases. No shortcuts.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              Each phase ends with working software, tests and a clear boundary. Phase 1 built the
              foundation; Phase 2 adds identity, sessions and PostgreSQL persistence. Phase 3 turns
              the empty workspace into a living ledger.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Progress
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {COMPLETED_PHASES}
              <span className="text-sm text-muted-foreground"> / {PHASES.length}</span>
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((phase, index) => {
            const meta = STATUS_META[phase.status];
            const highlighted = phase.id === LATEST_SHIPPED;

            return (
              <Reveal key={phase.id} delay={Math.min(index * 0.03, 0.2)}>
                <article
                  className={cn(
                    "relative h-full rounded-2xl border bg-card p-5",
                    highlighted
                      ? "border-primary/30 shadow-lg shadow-primary/5"
                      : "border-border/80",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                      PHASE {String(phase.id).padStart(2, "0")}
                    </span>
                    <Badge variant={meta.variant} className="gap-1.5">
                      <span className={cn("size-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold tracking-tight">{phase.name}</h3>
                  <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
                    {phase.summary}
                  </p>
                  {highlighted ? (
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-primary">
                      <Sparkles aria-hidden="true" className="size-3" />
                      Latest shipped milestone
                    </div>
                  ) : null}
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1} className="mt-6 rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CircleDot aria-hidden="true" className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Phase 2 exit criteria — met</h3>
          </div>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {EXIT_CRITERIA.map((criterion) => (
              <li
                key={criterion}
                className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground"
              >
                <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                {criterion}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
