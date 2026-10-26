import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)] opacity-50" />
        <div className="absolute top-1/4 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-emerald-400/15 blur-[120px] dark:bg-emerald-500/[0.08]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Back to site
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <Card className="overflow-hidden shadow-2xl shadow-black/5">
            <div className="relative border-b border-border/60 bg-gradient-to-br from-primary/[0.09] via-card to-sky-500/[0.05] px-6 pt-7 pb-6 text-center">
              <Badge variant="default" className="mb-3">
                Phase 2 · Identity
              </Badge>
              <h1 className="text-xl font-semibold tracking-[-0.03em]">{title}</h1>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </div>

            <CardContent className="p-6">{children}</CardContent>
          </Card>

          {footer ? (
            <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>
          ) : null}

          <div className="mt-5 flex items-start justify-center gap-2 text-center">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <p className="max-w-xs text-[10px] leading-5 text-muted-foreground">
              Argon2id password hashing, short-lived access tokens and a rotating HttpOnly refresh
              cookie. The access token never touches localStorage.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
