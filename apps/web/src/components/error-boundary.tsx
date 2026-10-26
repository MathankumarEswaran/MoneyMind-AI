import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
        <Logo linked={false} />
        <div className="max-w-md space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden="true" className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            The interface hit an unexpected error. Reloading usually fixes it. If it keeps
            happening, the API status panel on the dashboard can help diagnose the cause.
          </p>
          <Button onClick={() => window.location.reload()} className="mt-2">
            <RotateCcw aria-hidden="true" />
            Reload the app
          </Button>
        </div>
      </div>
    );
  }
}
