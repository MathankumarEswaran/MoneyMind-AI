import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "../constants.js";

export type MinorUnitInput = string | number | bigint;

const fractionDigitsCache = new Map<string, number>();

/**
 * Number of decimal places used by a currency (INR 2, USD 2, JPY 0, KWD 3).
 * Falls back to 2 for unknown codes so formatting never throws.
 */
export function getCurrencyFractionDigits(currency: string): number {
  const code = currency.toUpperCase();
  const cached = fractionDigitsCache.get(code);
  if (cached !== undefined) return cached;

  let digits: number;
  try {
    digits =
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }

  fractionDigitsCache.set(code, digits);
  return digits;
}

function toBigInt(value: MinorUnitInput): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Money value must be finite");
    return BigInt(Math.trunc(value));
  }

  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Invalid minor unit value: "${value}"`);
  }
  return BigInt(trimmed);
}

/**
 * Format integer minor units for display. Display-only: never use the output
 * for further arithmetic.
 */
export function formatMoney(
  amountMinor: MinorUnitInput,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
  options: Intl.NumberFormatOptions = {},
): string {
  const safeCurrency = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : DEFAULT_CURRENCY;
  const digits = getCurrencyFractionDigits(safeCurrency);
  const divisor = 10 ** digits;
  const major = Number(toBigInt(amountMinor)) / divisor;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: safeCurrency,
    ...options,
  }).format(major);
}

/**
 * Parse a human-entered decimal amount ("1,234.56") into integer minor units.
 * Rounds half away from zero and never performs floating-point arithmetic.
 */
export function parseMoneyToMinor(
  value: string | number,
  currency: string = DEFAULT_CURRENCY,
): bigint {
  const digits = getCurrencyFractionDigits(currency);
  const raw = typeof value === "number" ? value.toFixed(digits) : value.replace(/,/g, "").trim();

  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid money value: "${value}"`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePart = "0", fractionPart = ""] = unsigned.split(".");

  const padded = fractionPart.padEnd(digits + 1, "0");
  const kept = padded.slice(0, digits);
  const roundUp = Number(padded.charAt(digits) || "0") >= 5;

  const base =
    BigInt(wholePart || "0") * 10n ** BigInt(digits) + BigInt(kept || "0") + (roundUp ? 1n : 0n);

  return negative ? -base : base;
}

/** Exact integer addition, useful for aggregations once transactions arrive. */
export function sumMinor(...amounts: MinorUnitInput[]): bigint {
  return amounts.reduce<bigint>((total, amount) => total + toBigInt(amount), 0n);
}

export function isNegativeMinor(amountMinor: MinorUnitInput): boolean {
  return toBigInt(amountMinor) < 0n;
}
