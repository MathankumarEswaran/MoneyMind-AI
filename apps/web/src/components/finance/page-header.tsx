import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Consistent page heading used by every finance screen. Keeps the badge, title,
 * description and primary actions aligned across pages.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Badge variant="outline" className="gap-1.5 py-1">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {eyebrow}
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-[1.75rem]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
