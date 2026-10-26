import {
  ArrowUpRight,
  Check,
  CircleCheck,
  Database,
  FileSearch,
  Lock,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  {
    icon: FileSearch,
    title: "Grounded in your ledger",
    description:
      "Retrieval runs before generation. Transactions, budgets and ingested documents become context — not guesswork.",
  },
  {
    icon: Wrench,
    title: "Tool calling, not hand-waving",
    description:
      "Typed tools query spending, simulate a budget, or project a goal. Mutations require explicit confirmation.",
  },
  {
    icon: Database,
    title: "Portable by architecture",
    description:
      "One provider interface for chat, embeddings and streaming. Swap models without rewriting the product.",
  },
] as const;

export function AiSection() {
  return (
    <section id="ai" className="relative scroll-mt-28 overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.07] blur-[130px]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[0.92fr_1.08fr]">
        <Reveal>
          <Badge variant="outline" className="gap-1.5">
            <Sparkles aria-hidden="true" className="size-3" />
            AI copilot · Phase 4–6
          </Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-[2.6rem] sm:leading-[1.08]">
            An assistant that shows its work.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
            The copilot is designed for financial questions where a confident wrong answer is worse
            than no answer. It retrieves first, reasons with tools, then cites the exact source of
            every claim.
          </p>

          <div className="mt-8 space-y-5">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-primary">
                  <item.icon aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button asChild variant="outline" className="mt-8">
            <a href="#architecture">
              Read the AI architecture
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </Reveal>

        <Reveal delay={0.1} className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-500/10 via-transparent to-violet-500/10 blur-2xl"
          />
          <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/85 shadow-2xl shadow-black/10 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 text-white shadow-sm">
                  <Sparkles aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold">MoneyMind Copilot</p>
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Concept preview · grounded mode
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[9px]">
                Phase 4
              </Badge>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13px] leading-5 text-primary-foreground">
                Can I afford a $2,400 trip in April without touching my emergency fund?
              </div>

              <div className="max-w-[92%] space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles aria-hidden="true" className="size-3" />
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Answered with 3 tools · 1.8s
                  </span>
                </div>

                <div className="rounded-2xl rounded-tl-md border border-border/70 bg-background/50 p-3.5">
                  <p className="text-[13px] leading-6">
                    Yes — with about{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      $640 of headroom
                    </span>
                    . Your April cash flow covers the trip while keeping the emergency fund at six
                    months of essentials.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2">
                      <p className="text-[9px] text-muted-foreground">Projected April surplus</p>
                      <p className="text-sm font-semibold tabular-nums">$3,040</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2">
                      <p className="text-[9px] text-muted-foreground">Emergency fund after</p>
                      <p className="text-sm font-semibold tabular-nums">6.0 months</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["12 transactions", "April budget", "Japan trip goal"].map((citation) => (
                      <span
                        key={citation}
                        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2 py-0.5 text-[9px] text-muted-foreground"
                      >
                        <Lock aria-hidden="true" className="size-2.5" />
                        {citation}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    Tool trace
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {[
                      "get_cash_flow · Feb–Apr",
                      "get_budget_status · April",
                      "project_goal · Japan trip",
                    ].map((tool) => (
                      <li
                        key={tool}
                        className="flex items-center gap-2 text-[10px] text-muted-foreground"
                      >
                        <CircleCheck aria-hidden="true" className="size-3 text-emerald-500" />
                        <span className="font-mono">{tool}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t border-border/70 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2.5">
                <span className="flex-1 text-[11px] text-muted-foreground/70">
                  Ask about your spending…
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
                  Phase 4
                </span>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
                <Check aria-hidden="true" className="size-2.5 text-emerald-500" />
                Read-only by default · mutations need confirmation
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
