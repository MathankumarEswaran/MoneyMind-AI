import {
  ArrowRight,
  BrainCircuit,
  Database,
  MonitorSmartphone,
  ServerCog,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";

const LAYERS = [
  {
    icon: MonitorSmartphone,
    label: "Experience",
    title: "React client",
    items: [
      "React 19 + Vite + TypeScript",
      "Tailwind CSS 4 + shadcn-style primitives",
      "TanStack Query + typed API contracts",
      "Framer Motion · R3F in Phase 7",
    ],
  },
  {
    icon: ServerCog,
    label: "Application",
    title: "Modular monolith",
    items: [
      "Express 5 with feature routers",
      "Zod validation at every boundary",
      "JWT sessions + rotating refresh tokens",
      "Rate limits, request IDs, redacted logs",
    ],
  },
  {
    icon: Database,
    label: "Data",
    title: "Ledger + knowledge",
    items: [
      "PostgreSQL 16 with Prisma migrations",
      "Integer minor units for every amount",
      "Qdrant for user-scoped embeddings",
      "Object storage for source documents",
    ],
  },
  {
    icon: BrainCircuit,
    label: "Intelligence",
    title: "Provider-agnostic AI",
    items: [
      "One interface for chat + embeddings",
      "Hybrid retrieval with reranking",
      "Typed tools with confirmation gates",
      "Golden-set evals, cost + latency budgets",
    ],
  },
] as const;

const PIPELINE = [
  "Ingest document",
  "Parse + chunk",
  "Embed",
  "Qdrant upsert",
  "Hybrid retrieve",
  "Grounded answer",
] as const;

export function ArchitectureSection() {
  return (
    <section
      id="architecture"
      className="relative scroll-mt-28 border-y border-border/60 bg-card/25 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline">System design</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-[2.6rem] sm:leading-[1.08]">
              A foundation built for Phase 9.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              A modular monolith with clear seams: feature routers, a shared contract package,
              isolated data access and an AI layer that can change providers without changing the
              product.
            </p>
          </div>
          <p className="max-w-xs text-xs leading-6 text-muted-foreground">
            Start simple, split later. Boundaries are enforced by folders, types and tests — not by
            premature microservices.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((layer, index) => (
            <Reveal key={layer.title} delay={index * 0.05} className="h-full">
              <article className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <layer.icon aria-hidden="true" className="size-4" />
                  </span>
                  <span aria-hidden="true" className="font-mono text-[10px] text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-4 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {layer.label}
                </p>
                <h3 className="mt-1 text-[15px] font-semibold tracking-tight">{layer.title}</h3>
                <ul className="mt-4 space-y-2">
                  {layer.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[12px] leading-5 text-muted-foreground"
                    >
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-6">
          <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles aria-hidden="true" className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">RAG pipeline · Phase 5</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                User-scoped payload filters · citation IDs on every chunk
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {PIPELINE.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-[11px] font-medium">
                    <span className="mr-1.5 font-mono text-[9px] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </span>
                  {index < PIPELINE.length - 1 ? (
                    <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground/50" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
