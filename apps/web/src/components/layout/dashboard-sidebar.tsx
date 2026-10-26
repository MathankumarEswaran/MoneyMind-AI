import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  ChartPie,
  ChevronDown,
  Flag,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  ReceiptText,
  Settings,
  Sparkles,
  Tags,
  Target,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PHASE_COUNT, PHASES } from "@moneymind/shared";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  phase?: number;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", icon: LayoutDashboard, to: "/dashboard" },
      { label: "Transactions", icon: ReceiptText, to: "/transactions" },
      { label: "Categories", icon: Tags, to: "/categories" },
      { label: "Budgets", icon: Target, to: "/budgets" },
      { label: "Goals", icon: Flag, to: "/goals" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", icon: ChartPie, to: "/analytics" },
      { label: "AI Copilot", icon: Sparkles, to: "/copilot" },
      { label: "Documents", icon: Wallet, phase: 5 },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", icon: UserRound, to: "/profile" },
      { label: "Settings", icon: Settings, phase: 7 },
    ],
  },
];

const COMPLETED_PHASES = PHASES.filter((phase) => phase.status === "complete").length;
const PHASE_PROGRESS = Math.round((COMPLETED_PHASES / PHASE_COUNT) * 100);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const value = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return value || "MM";
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const workspace = user?.workspace ?? null;
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (!auth) return;

    setSigningOut(true);
    try {
      await auth.logout();
    } catch {
      // Local state is cleared even if the network call fails.
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 px-5">
        <Logo />
      </div>

      <div className="px-3 pt-3">
        <Link
          to={user ? "/profile" : "/login"}
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-card p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-accent/40"
          title={user ? "View profile and sessions" : "Sign in to open your workspace"}
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/80 to-sky-500/80 text-[10px] font-semibold text-white">
            {(workspace?.name.trim()[0] ?? "P").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold">
              {workspace?.name ?? "Personal"}
            </span>
            <span className="block truncate text-[9px] text-muted-foreground">
              {workspace ? `${workspace.baseCurrency || "INR"} · ${workspace.role}` : "INR · Preview"}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </Link>
      </div>

      <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2 text-[9px] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                {group.label}
              </p>
              <ul className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const active = item.to === pathname;

                  return (
                    <li key={item.label}>
                      {item.to ? (
                        <Link
                          to={item.to}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                          )}
                        >
                          <item.icon aria-hidden="true" className="size-4" />
                          <span className="flex-1">{item.label}</span>
                          {active ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          title={`${item.label} arrives in Phase ${item.phase}`}
                          className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-muted-foreground/65"
                        >
                          <item.icon aria-hidden="true" className="size-4" />
                          <span className="flex-1">{item.label}</span>
                          <LockKeyhole aria-hidden="true" className="size-2.5" />
                          <span className="font-mono text-[9px]">P{item.phase}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 space-y-3 border-t border-border/60 p-3">
        <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-transparent p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold">Identity &amp; data</p>
            <Badge variant="default" className="px-1.5 py-0 text-[8px]">
              {COMPLETED_PHASES} of {PHASE_COUNT}
            </Badge>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${PHASE_PROGRESS}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
            <span>
              {COMPLETED_PHASES} of {PHASE_COUNT} phases
            </span>
            <Link
              to="/#roadmap"
              onClick={onNavigate}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Roadmap
              <ArrowUpRight aria-hidden="true" className="size-2.5" />
            </Link>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2.5">
            <Link
              to="/profile"
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2.5"
              aria-label="Open your profile"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-sky-500/20 text-[10px] font-semibold text-primary">
                {initials(user.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium">{user.name}</span>
                <span className="block truncate text-[9px] text-muted-foreground">
                  {user.email}
                </span>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-label={signingOut ? "Signing out" : "Sign out"}
              title="Sign out"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-sky-500/20 text-[10px] font-semibold text-primary">
              MM
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">Preview user</p>
              <p className="text-[9px] text-muted-foreground">Not signed in</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[10px]">
              <Link to="/login" onClick={onNavigate}>
                Sign in
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
