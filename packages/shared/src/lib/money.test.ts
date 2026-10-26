import { describe, expect, it } from "vitest";
import { CurrencySchema, MoneySchema } from "../schemas/common.js";
import {
  formatMoney,
  getCurrencyFractionDigits,
  isNegativeMinor,
  parseMoneyToMinor,
  sumMinor,
} from "./money.js";

describe("currency + money schemas", () => {
  it("accepts and normalizes ISO currency codes", () => {
    expect(CurrencySchema.parse("inr")).toBe("INR");
    expect(() => CurrencySchema.parse("US")).toThrow();
    expect(() => CurrencySchema.parse("US1")).toThrow();
  });

  it("rejects non-integer minor units", () => {
    expect(() => MoneySchema.parse({ amountMinor: "12.34", currency: "INR" })).toThrow();
    expect(MoneySchema.parse({ amountMinor: "-1200", currency: "INR" })).toEqual({
      amountMinor: "-1200",
      currency: "INR",
    });
  });
});

describe("formatMoney", () => {
  it("formats INR minor units", () => {
    expect(formatMoney("123456", "INR")).toBe("₹1,234.56");
  });

  it("supports zero-decimal currencies", () => {
    expect(getCurrencyFractionDigits("JPY")).toBe(0);
    expect(formatMoney(1234, "JPY")).toContain("1,234");
  });

  it("supports three-decimal currencies", () => {
    expect(getCurrencyFractionDigits("KWD")).toBe(3);
    expect(formatMoney("1234", "KWD")).toContain("1.234");
  });

  it("falls back safely for malformed currencies", () => {
    expect(formatMoney("100", "NOT_A_CODE")).toBe("₹1.00");
  });

  it("formats negative amounts", () => {
    expect(formatMoney(-5000, "INR")).toBe("-₹50.00");
  });
});

describe("parseMoneyToMinor", () => {
  it("parses decimals without floating point drift", () => {
    expect(parseMoneyToMinor("1234.56")).toBe(123456n);
    expect(parseMoneyToMinor("0.1")).toBe(10n);
    expect(parseMoneyToMinor("1,234.56")).toBe(123456n);
  });

  it("rounds half away from zero", () => {
    expect(parseMoneyToMinor("0.005")).toBe(1n);
    expect(parseMoneyToMinor("1.999")).toBe(200n);
    expect(parseMoneyToMinor("-0.005")).toBe(-1n);
  });

  it("handles zero-decimal currencies", () => {
    expect(parseMoneyToMinor("1500", "JPY")).toBe(1500n);
    expect(parseMoneyToMinor("1500.6", "JPY")).toBe(1501n);
  });

  it("rejects invalid input", () => {
    expect(() => parseMoneyToMinor("twelve")).toThrow();
    expect(() => parseMoneyToMinor("1.2.3")).toThrow();
    expect(() => parseMoneyToMinor(Number.NaN)).toThrow();
  });
});

describe("sumMinor", () => {
  it("adds mixed representations exactly", () => {
    expect(sumMinor("100", 250, 5n)).toBe(355n);
  });

  it("preserves signs", () => {
    expect(sumMinor("1000", "-250")).toBe(750n);
    expect(isNegativeMinor("-1")).toBe(true);
  });
});
