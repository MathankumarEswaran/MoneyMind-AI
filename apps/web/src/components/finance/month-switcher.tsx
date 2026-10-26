import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths } from "@moneymind/shared";
import { Button } from "@/components/ui/button";
import { formatMonthLabel } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function MonthSwitcher({
  month,
  onChange,
  locale,
  className,
}: {
  month: string;
  onChange: (month: string) => void;
  locale: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span className="min-w-[7.5rem] px-1 text-center text-xs font-medium">
        {formatMonthLabel(month, locale)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
