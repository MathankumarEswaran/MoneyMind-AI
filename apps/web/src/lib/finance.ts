import {
  currentMonthInTimeZone,
  dateOnlyInTimeZone,
  formatMoney,
  getCurrencyFractionDigits,
  type CategoryBreakdownItem,
} from "@moneymind/shared";
import { ApiClientError } from "@/lib/api";

const FRIENDLY_MESSAGES: Record<string, string> = {
  CATEGORY_EXISTS: "A category with that name already exists.",
  CATEGORY_IN_USE: "Move or delete this category's transactions and budgets first.",
  CATEGORY_SYSTEM: "Starter categories can be renamed but not deleted.",
  CATEGORY_TYPE_MISMATCH: "Pick a category that matches this transaction type.",
  CATEGORY_INVALID: "That category is no longer available. Refresh and try again.",
  BUDGET_EXISTS: "A budget already exists for that category and month.",
  GOAL_ARCHIVED: "Reopen this goal before adding contributions.",
  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
  NETWORK_ERROR: "Could not reach the MoneyMind API. Check that it is running and try again.",
  TIMEOUT: "The API took too long to respond. Please try again.",
  NO_SESSION: "Your session has expired. Please sign in again.",
  SESSION_REVOKED: "This session has ended. Please sign in again.",
  INVALID_RESPONSE: "The API returned an unexpected response. Please try again.",
  RATE_LIMITED: "Too many requests. Wait a moment and try again.",
};

export function describeFinanceError(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return FRIENDLY_MESSAGES[error.code] ?? error.message ?? fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Validation field errors shaped like the API's `details.fields`. */
export function fieldErrorsFrom(error: unknown): Record<string, string[]> | null {
  if (!(error instanceof ApiClientError) || error.code !== "VALIDATION_ERROR") return null;

  const details = error.details as { fields?: Record<string, string[]> } | undefined;
  return details?.fields ?? null;
}

export function formatMinor(
  amountMinor: string,
  currency: string,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return formatMoney(amountMinor, currency, locale, options);
}

/** Render minor units back into the decimal string a form input expects. */
export function minorToAmountInput(amountMinor: string, currency: string): string {
  const digits = getCurrencyFractionDigits(currency);
  const value = BigInt(amountMinor);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const divisor = 10n ** BigInt(digits);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const text =
    digits > 0 ? `${whole}.${fraction.toString().padStart(digits, "0")}` : whole.toString();

  return negative ? `-${text}` : text;
}

export function formatMonthLabel(month: string, locale = "en-IN"): string {
  const date = new Date(`${month}-01T12:00:00.000Z`);

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateOnlyLabel(dateOnly: string, locale = "en-IN"): string {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthShort(month: string, locale = "en-IN"): string {
  const date = new Date(`${month}-01T12:00:00.000Z`);

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateLabel(iso: string, timeZone: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

export function dateInputValue(iso: string, timeZone: string): string {
  return dateOnlyInTimeZone(new Date(iso), timeZone);
}

export function todayInTimeZone(timeZone: string): string {
  return dateOnlyInTimeZone(new Date(), timeZone);
}

export function thisMonth(timeZone: string): string {
  return currentMonthInTimeZone(timeZone);
}

export function formatPercent(value: number | null, fractionDigits = 1): string {
  if (value === null) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatSignedPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function totalMinor(items: CategoryBreakdownItem[]): string {
  return items.reduce((sum, item) => sum + BigInt(item.amountMinor), 0n).toString();
}

/** First and last calendar date of a month, for the transaction date filters. */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year ?? 1970, monthNumber ?? 1, 0)).getUTCDate();

  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function signedAmount(
  type: "INCOME" | "EXPENSE",
  amountMinor: string,
  currency: string,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  const formatted = formatMinor(amountMinor, currency, locale, options);
  return type === "INCOME" ? `+${formatted}` : `\u2212${formatted}`;
}
