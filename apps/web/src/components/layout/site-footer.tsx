import { Link } from "react-router-dom";
import { APP_VERSION } from "@moneymind/shared";
import { Logo } from "@/components/brand/logo";
import { Separator } from "@/components/ui/separator";

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "AI copilot", href: "/#ai" },
      { label: "Roadmap", href: "/#roadmap" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Engineering",
    links: [
      { label: "Architecture", href: "/#architecture" },
      { label: "Security", href: "/#security" },
      { label: "API health", href: "/dashboard" },
      { label: "Phase 2 report", href: "/#roadmap" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Create account", href: "/register" },
      { label: "Sign in", href: "/login" },
      { label: "Privacy approach", href: "/#security" },
      { label: "Back to top", href: "/#top" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/60">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs space-y-4">
            <Logo linked={false} />
            <p className="text-sm leading-6 text-muted-foreground">
              A production-minded personal finance workspace. Built in public, phase by phase, with
              an AI copilot that shows its work.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Phase 2 · identity &amp; data · v{APP_VERSION}
            </div>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold tracking-[0.14em] text-foreground uppercase">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) =>
                  link.href.startsWith("#") ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MoneyMind AI. Built in public, phase by phase.</p>
          <p className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Auth &amp; database live · Core finance up next
          </p>
        </div>
      </div>
    </footer>
  );
}
