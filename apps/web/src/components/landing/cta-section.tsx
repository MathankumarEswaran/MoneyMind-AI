import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

export function CtaSection() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-emerald-500/10 via-card to-sky-500/10 p-8 text-center shadow-2xl shadow-black/5 sm:p-14">
            <div
              aria-hidden="true"
              className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_50%,black,transparent)] opacity-40"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl"
            />

            <div className="relative">
              <p className="text-[11px] font-medium tracking-[0.18em] text-primary uppercase">
                Your workspace is ready
              </p>
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-[2.75rem] sm:leading-[1.05]">
                See where your money is going — before it goes.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Phase 2 gives you a real account, a private workspace and secure sessions. Next up:
                accounts, transactions, budgets and a living ledger.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/register">
                    Create your account
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/login">
                    Sign in
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <p className="mt-6 text-[11px] text-muted-foreground">
                Free account · No financial data collected · Your workspace stays private
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
