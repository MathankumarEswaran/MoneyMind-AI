import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  index?: number;
  badge?: string;
}

export function StatCard({ label, value, hint, icon: Icon, index = 0, badge }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-24 rounded-full bg-primary/[0.04] blur-2xl"
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </p>
        <span className="flex size-7 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
          <Icon aria-hidden="true" className="size-3.5" />
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight tabular-nums",
          value === "—" && "text-muted-foreground/60",
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">{hint}</p>
        {badge ? (
          <Badge variant="outline" className="px-1.5 py-0 text-[8px]">
            {badge}
          </Badge>
        ) : null}
      </div>
    </motion.div>
  );
}
