import { ApiClientError } from "@/lib/api";

const FRIENDLY_MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: "An account with that email already exists. Try signing in instead.",
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
  NETWORK_ERROR: "Could not reach the MoneyMind API. Check that it is running and try again.",
  TIMEOUT: "The API took too long to respond. Please try again.",
  NO_SESSION: "Your session has expired. Please sign in again.",
  SESSION_REVOKED: "This session has ended. Please sign in again.",
  INVALID_RESPONSE: "The API returned an unexpected response. Please try again.",
};

/**
 * Server messages are already user-facing, but stable codes keep the UI helpful
 * even when the API is unreachable or returns a generic transport error.
 */
export function describeAuthError(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return FRIENDLY_MESSAGES[error.code] ?? error.message;
  }

  return fallback;
}
