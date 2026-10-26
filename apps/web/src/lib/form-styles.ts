import { cn } from "@/lib/utils";

/** Shared invalid-state styling for native inputs and selects. */
export function fieldInputClass(error?: string): string {
  return cn(error && "border-destructive/60 focus-visible:border-destructive");
}
