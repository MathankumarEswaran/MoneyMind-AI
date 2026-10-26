import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dateOnlyInTimeZone,
  dateOnlyToUtcNoon,
  dayStartUtc,
  isDateOnly,
  isMonth,
  isValidTimeZone,
  monthOf,
  monthRangeUtc,
  trailingMonths,
  zonedWallClockToUtc,
} from "./dates.js";

describe("month helpers", () => {
  it("recognises calendar months and dates", () => {
    expect(isMonth("2026-01")).toBe(true);
    expect(isMonth("2026-12")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-1")).toBe(false);

    expect(isDateOnly("2026-02-28")).toBe(true);
    expect(isDateOnly("2026-02-31")).toBe(false);
    expect(isDateOnly("2026-2-3")).toBe(false);
  });

  it("adds months across year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-07", -12)).toBe("2025-07");
  });

  it("adds days without time-zone drift", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("returns contiguous trailing months, oldest first", () => {
    expect(trailingMonths("2026-03", 4)).toEqual(["2025-12", "2026-01", "2026-02", "2026-03"]);
  });
});

describe("time-zone conversion", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("converts UTC wall clock without shifting", () => {
    expect(zonedWallClockToUtc("2026-03-01T00:00:00.000", "UTC").toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
  });

  it("resolves month boundaries in a negative-offset zone across DST", () => {
    const march = monthRangeUtc("2026-03", "America/New_York");
    expect(march.start.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    // DST starts on 2026-03-08, so April begins at UTC-4.
    expect(march.end.toISOString()).toBe("2026-04-01T04:00:00.000Z");
  });

  it("resolves a half-hour offset zone", () => {
    const march = monthRangeUtc("2026-03", "Asia/Kolkata");
    expect(march.start.toISOString()).toBe("2026-02-28T18:30:00.000Z");
    expect(march.end.toISOString()).toBe("2026-03-31T18:30:00.000Z");
  });

  it("keeps late-evening instants in the local month", () => {
    expect(monthOf(new Date("2026-03-01T03:00:00.000Z"), "America/New_York")).toBe("2026-02");
    expect(monthOf(new Date("2026-03-01T03:00:00.000Z"), "UTC")).toBe("2026-03");
  });

  it("renders a local noon instant back as the same calendar date", () => {
    for (const zone of ["UTC", "America/New_York", "Asia/Kolkata", "Pacific/Auckland"]) {
      const instant = dateOnlyToUtcNoon("2026-03-05", zone);
      expect(dateOnlyInTimeZone(instant, zone)).toBe("2026-03-05");
      expect(dayStartUtc("2026-03-05", zone).getTime()).toBeLessThan(instant.getTime());
    }
  });
});
