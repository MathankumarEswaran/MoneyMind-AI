import { Link } from "react-router-dom";
import { ArrowLeft, Compass, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";

export default function NotFoundPage() {
  usePageTitle("Page not found");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)] opacity-50" />
        <div className="absolute top-1/3 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
      </header>

      <main
        id="main"
        className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center"
      >
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          Error 404
        </p>
        <h1 className="mt-4 text-6xl font-semibold tracking-[-0.06em] sm:text-8xl">
          <span className="text-gradient">Lost</span> in the ledger.
        </h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
          This page does not exist — or it belongs to a phase that has not shipped yet. The roadmap
          on the landing page shows what is live.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/">
              <ArrowLeft aria-hidden="true" />
              Back home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">
              <LayoutDashboard aria-hidden="true" />
              Open dashboard
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/#roadmap">
              <Compass aria-hidden="true" />
              View roadmap
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
