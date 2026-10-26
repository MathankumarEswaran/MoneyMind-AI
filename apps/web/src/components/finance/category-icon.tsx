import { Tag } from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
}) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || Tag;
  const tint = color ?? "#64748b";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50",
        className,
      )}
      style={{ backgroundColor: `${tint}1f`, color: tint }}
    >
      <Icon className="size-4" />
    </span>
  );
}
