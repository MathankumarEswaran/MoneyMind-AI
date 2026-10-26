export const INR_CURRENCY = "INR" as const;
export const INR_LOCALE = "en-IN" as const;

export function formatCurrency(amountMinorOrMajor: bigint | number | string, options?: {
  currency?: string;
  locale?: string;
  isMinor?: boolean;
}): string {
  const currency = options?.currency ?? INR_CURRENCY;
  const locale = options?.locale ?? INR_LOCALE;
  const isMinor = options?.isMinor ?? false;

  let numeric: number;
  if (typeof amountMinorOrMajor === "bigint") {
    numeric = Number(amountMinorOrMajor);
  } else if (typeof amountMinorOrMajor === "string") {
    numeric = Number(amountMinorOrMajor);
  } else {
    numeric = amountMinorOrMajor;
  }

  const major = isMinor ? numeric / 100 : numeric;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(major);
}

export function formatCurrencyFromMinor(amountMinor: bigint | string): string {
  return formatCurrency(amountMinor, { isMinor: true });
}
