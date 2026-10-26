import { Logo } from "@/components/brand/logo";

export function AuthLoading({ label = "Checking your session…" }: { label?: string }) {
  return (
    <main
      id="main"
      className="flex min-h-dvh items-center justify-center bg-background px-6"
      aria-busy="true"
    >
      <div role="status" className="flex flex-col items-center gap-4 text-center">
        <Logo linked={false} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
          {label}
        </div>
      </div>
    </main>
  );
}
