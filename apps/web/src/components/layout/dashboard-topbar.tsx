import { Link, useLocation } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOptionalAuth } from "@/providers/auth-provider";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const value = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return value || "MM";
}

const SECTION_BY_PATH: Record<string, { group?: string; current: string }> = {
  "/dashboard": { current: "Overview" },
  "/transactions": { current: "Transactions" },
  "/categories": { current: "Categories" },
  "/budgets": { current: "Budgets" },
  "/goals": { current: "Goals" },
  "/analytics": { group: "Intelligence", current: "Analytics" },
  "/copilot": { group: "Intelligence", current: "AI Copilot" },
  "/profile": { group: "Account", current: "Profile" },
};

export function DashboardTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const workspace = user?.workspace ?? null;
  const section = SECTION_BY_PATH[pathname] ?? { current: "Overview" };
  const group = section.group ?? workspace?.name ?? "Workspace";

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMenu}
          aria-label="Open navigation"
        >
          <Menu aria-hidden="true" />
        </Button>

        <div className="hidden min-w-0 items-center gap-2 text-xs sm:flex">
          <span className="truncate text-muted-foreground">{group}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-medium">{section.current}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            to="/transactions"
            className="mr-1 hidden items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground md:flex"
            title="Search your transactions"
          >
            <Search aria-hidden="true" className="size-3.5" />
            <span>Search</span>
            <kbd className="rounded border border-border/70 px-1 py-px font-mono text-[9px]">
              ⌘K
            </kbd>
          </Link>

          <Badge variant="outline" className="hidden gap-1.5 py-1 sm:inline-flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Phase 4 · AI Assistant
          </Badge>

          <ThemeToggle />

          <Link
            to={user ? "/profile" : "/login"}
            className="ml-1 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-sky-500/20 text-[10px] font-semibold text-primary ring-1 ring-border transition hover:ring-primary/40"
            aria-label={user ? `${user.name} — open your profile` : "Sign in"}
            title={user ? "Profile & security" : "Sign in"}
          >
            {user ? initials(user.name) : "MM"}
          </Link>
        </div>
      </div>
    </header>
  );
}
