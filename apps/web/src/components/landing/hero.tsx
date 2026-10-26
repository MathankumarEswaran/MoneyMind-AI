import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ChartPie,
  Check,
  CircleDollarSign,
  LayoutDashboard,
  ReceiptText,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STACK = [
  "React 19",
  "TypeScript",
  "Vite",
  "Tailwind CSS",
  "Express 5",
  "PostgreSQL",
  "Prisma",
  "Qdrant",
] as const;

const TRUST_POINTS = ["Phase 2 live", "Typed end to end", "Docs-first architecture"] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_72%_58%_at_50%_28%,black,transparent)] opacity-60 dark:opacity-35" />
        <div className="absolute top-[-14rem] left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-emerald-400/25 blur-[120px] dark:bg-emerald-500/10" />
        <div className="absolute top-24 -right-32 size-[26rem] rounded-full bg-sky-400/20 blur-[110px] dark:bg-sky-500/10" />
        <div className="absolute top-56 -left-32 size-[24rem] rounded-full bg-violet-400/15 blur-[110px] dark:bg-violet-500/10" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge variant="outline" className="mb-6 gap-2 py-1 pr-3 pl-2.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Phase 2 · accounts are live
          </Badge>

          <h1 className="max-w-xl text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.4rem]">
            Your money, with a <span className="text-gradient">mind of its own.</span>
          </h1>

          <p className="mt-6 max-w-lg text-[15px] leading-7 text-muted-foreground sm:text-base">
            MoneyMind AI turns scattered transactions, budgets and goals into one calm workspace —
            then explains what to do next with an assistant that cites your real numbers.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Create your account
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#architecture">
                See the blueprint
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check aria-hidden="true" className="size-3.5 text-emerald-500" />
                {point}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:pl-4"
        >
          <ProductPreview />
        </motion.div>
      </div>

      <div className="mx-auto mt-16 max-w-6xl px-6 sm:mt-24">
        <div className="flex flex-col items-center gap-5 border-t border-border/60 pt-8 sm:flex-row sm:justify-between">
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Planned production stack
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {STACK.map((item) => (
              <li
                key={item}
                className="rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-md lg:max-w-none" aria-label="Dashboard preview">
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-tr from-emerald-500/15 via-transparent to-sky-500/15 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <div aria-hidden="true" className="flex gap-1.5">
            <span className="size-2 rounded-full bg-red-400/70" />
            <span className="size-2 rounded-full bg-amber-400/70" />
            <span className="size-2 rounded-full bg-emerald-400/70" />
          </div>
          <div className="mx-auto flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-3 py-1 text-[9px] text-muted-foreground">
            <span className="size-1 rounded-full bg-emerald-500" />
            app.moneymind.ai/dashboard
          </div>
          <Badge variant="outline" className="px-2 py-0 text-[8px] uppercase">
            Preview
          </Badge>
        </div>

        <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[56px_1fr]">
          <aside className="flex flex-col items-center gap-1.5 border-r border-border/60 bg-background/30 py-4">
            <div className="mb-3 flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 text-white shadow-sm">
              <TrendingUp aria-hidden="true" className="size-3.5" />
            </div>
            {[
              { icon: LayoutDashboard, active: true },
              { icon: ReceiptText, active: false },
              { icon: ChartPie, active: false },
              { icon: Target, active: false },
              { icon: Sparkles, active: false },
            ].map(({ icon: Icon, active }, index) => (
              <div
                key={index}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  active ? "bg-primary/12 text-primary" : "text-muted-foreground/50",
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
              </div>
            ))}
            <div className="mt-auto flex size-7 items-center justify-center rounded-full border border-border/70 bg-secondary text-[8px] font-semibold text-secondary-foreground">
              MM
            </div>
          </aside>

          <div className="space-y-3.5 p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Net worth
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    $42,680.00
                  </span>
                  <span className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                    <TrendingUp aria-hidden="true" className="size-2.5" />
                    +12.4%
                  </span>
                </div>
              </div>
              <span className="rounded-full border border-border/60 px-2 py-1 text-[8px] text-muted-foreground">
                This month
              </span>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-emerald-500/5 to-transparent p-2">
              <svg
                viewBox="0 0 320 84"
                role="img"
                aria-label="Sample net worth trend, trending upward"
                className="h-20 w-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.15 164)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="oklch(0.72 0.15 164)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 66 C24 62 34 52 52 54 C72 56 82 44 102 46 C124 48 132 33 154 34 C176 35 186 26 206 28 C228 30 238 18 258 20 C280 22 296 10 320 8 L320 84 L0 84 Z"
                  fill="url(#hero-area)"
                />
                <path
                  d="M0 66 C24 62 34 52 52 54 C72 56 82 44 102 46 C124 48 132 33 154 34 C176 35 186 26 206 28 C228 30 238 18 258 20 C280 22 296 10 320 8"
                  fill="none"
                  stroke="oklch(0.72 0.15 164)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                  <Wallet aria-hidden="true" className="size-2.5" />
                  Monthly spend
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums">$3,284.12</p>
                <p className="mt-0.5 text-[8px] text-emerald-600 dark:text-emerald-400">
                  18% below budget
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                  <CircleDollarSign aria-hidden="true" className="size-2.5" />
                  Savings rate
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums">31.6%</p>
                <p className="mt-0.5 text-[8px] text-muted-foreground">4-month high</p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-3">
              <div className="flex items-center gap-1.5">
                <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Sparkles aria-hidden="true" className="size-3" />
                </span>
                <span className="text-[9px] font-semibold">Insight, grounded in your data</span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Dining is down 18% this month. Moving the difference to your{" "}
                <span className="font-medium text-foreground">Japan trip</span> would put the goal 3
                weeks ahead of schedule.
              </p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[8px] font-medium text-emerald-700 dark:text-emerald-300">
                  Apply suggestion
                </span>
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[8px] text-muted-foreground">
                  12 transactions cited
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-float-slow absolute -top-4 -right-2 hidden items-center gap-2 rounded-2xl border border-border/70 bg-card/90 px-3 py-2 shadow-xl shadow-black/5 backdrop-blur-md sm:flex">
        <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Sparkles aria-hidden="true" className="size-3.5" />
        </span>
        <div>
          <p className="text-[10px] font-semibold">Every answer cited</p>
          <p className="text-[8px] text-muted-foreground">RAG pipeline · Phase 5</p>
        </div>
      </div>

      <div className="animate-float-slower absolute -bottom-4 -left-2 hidden items-center gap-2 rounded-2xl border border-border/70 bg-card/90 px-3 py-2 shadow-xl shadow-black/5 backdrop-blur-md sm:flex">
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Check aria-hidden="true" className="size-3.5" />
        </span>
        <div>
          <p className="text-[10px] font-semibold">Foundation verified</p>
          <p className="text-[8px] text-muted-foreground">Lint · types · tests</p>
        </div>
      </div>
    </div>
  );
}
