import { ChartSpline, Flag, ShieldCheck, Sparkles, Target, Wallet } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: Wallet,
    title: "One clear money picture",
    description:
      "Accounts, income and spending in a single ledger. Multi-currency-ready with integer minor units, so totals never drift.",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Target,
    title: "Budgets with guardrails",
    description:
      "Category budgets by month, week or year. Threshold alerts and pace-aware projections instead of a static number.",
    accent: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    icon: Flag,
    title: "Goals with momentum",
    description:
      "Track contributions, projected completion dates and what a small change today does to the finish line.",
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: ChartSpline,
    title: "Analytics that explain",
    description:
      "Cash flow, category trends and savings rate — with plain-language notes on what moved and why it matters.",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Sparkles,
    title: "A copilot with receipts",
    description:
      "Ask questions in natural language. Every answer is grounded in retrieved transactions and documents, with citations.",
    accent: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    description:
      "Per-user data scoping, short-lived sessions, prompt-injection defenses and redacted logs. Security is a phase, not a patch.",
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-28 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <Badge variant="outline">The workspace</Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-[2.6rem] sm:leading-[1.08]">
            A finance workspace, not another spreadsheet.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
            Every module is designed to answer a real question — where the money went, whether the
            budget is healthy, and what to do next.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.04}>
              <article className="group relative h-full overflow-hidden rounded-2xl border border-border/80 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-xl hover:shadow-black/5">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-20 -right-20 size-40 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                />
                <span
                  className={`flex size-10 items-center justify-center rounded-xl ${feature.accent}`}
                >
                  <feature.icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-5 text-[15px] font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
