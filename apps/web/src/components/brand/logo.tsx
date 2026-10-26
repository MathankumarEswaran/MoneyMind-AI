import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  linked?: boolean;
  wordmarkClassName?: string;
}

export function Logo({
  className,
  showWordmark = true,
  linked = true,
  wordmarkClassName,
}: LogoProps) {
  const content = (
    <>
      <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-sky-500 shadow-lg shadow-emerald-500/20">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="size-5 text-white drop-shadow-sm"
        >
          <path
            d="M4.5 16.5 9.5 11l3.2 3.2L19.5 7"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="19.5" cy="7" r="1.8" fill="currentColor" />
        </svg>
        <span className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
      </span>
      {showWordmark ? (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          MoneyMind <span className="text-primary">AI</span>
        </span>
      ) : null}
    </>
  );

  const classes = cn("group flex items-center gap-2.5", className);

  if (!linked) {
    return (
      <div className={classes} aria-label="MoneyMind AI">
        {content}
      </div>
    );
  }

  return (
    <Link to="/" className={classes} aria-label="MoneyMind AI home">
      {content}
    </Link>
  );
}
