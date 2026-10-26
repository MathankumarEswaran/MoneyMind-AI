/** Only same-origin absolute paths are accepted, preventing open redirects. */
export function readRedirectTarget(state: unknown, fallback = "/dashboard"): string {
  if (state && typeof state === "object" && "from" in state) {
    const from = (state as { from?: unknown }).from;

    if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
      return from;
    }
  }

  return fallback;
}
