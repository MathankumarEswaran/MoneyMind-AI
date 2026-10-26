/**
 * Calendar helpers shared by the API and the web client.
 *
 * Every "which month is this?" question is answered in the user's IANA time
 * zone, never the server's. That keeps a purchase made at 23:30 in Lagos inside
 * the correct local month even though the API runs in UTC.
 *
 * These helpers are pure and dependency-free so they run in Node and browsers.
 */

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock parts of an instant as observed in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year ?? 1970,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour === 24 ? 0 : (values.hour ?? 0),
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds (east of UTC is positive). */
function offsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  // Compare whole seconds; the formatter never returns milliseconds.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/**
 * Convert a wall-clock value (`YYYY-MM-DDTHH:mm:ss.sss`, no offset) in
 * `timeZone` to the matching UTC instant. Two passes converge even when the
 * first guess lands on the wrong side of a DST transition.
 */
export function zonedWallClockToUtc(wallClock: string, timeZone: string): Date {
  const target = Date.parse(`${wallClock}Z`);

  if (Number.isNaN(target)) {
    throw new Error(`Invalid wall-clock value: "${wallClock}"`);
  }

  let instant = target - offsetMs(new Date(target), timeZone);
  instant = target - offsetMs(new Date(instant), timeZone);

  return new Date(instant);
}

export function isMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function isDateOnly(value: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function addMonths(month: string, delta: number): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Invalid month: "${month}"`);

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1));

  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

/** The month (`YYYY-MM`) an instant falls into, observed in `timeZone`. */
export function monthOf(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}`;
}

export function currentMonthInTimeZone(timeZone: string, now: Date = new Date()): string {
  return monthOf(now, timeZone);
}

/** Calendar date (`YYYY-MM-DD`) of an instant, observed in `timeZone`. */
export function dateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Start (inclusive) and end (exclusive) instants of a local calendar month. */
export function monthRangeUtc(month: string, timeZone: string): { start: Date; end: Date } {
  if (!isMonth(month)) throw new Error(`Invalid month: "${month}"`);

  return {
    start: zonedWallClockToUtc(`${month}-01T00:00:00.000`, timeZone),
    end: zonedWallClockToUtc(`${addMonths(month, 1)}-01T00:00:00.000`, timeZone),
  };
}

/** Start of a local calendar day as a UTC instant. */
export function dayStartUtc(dateOnly: string, timeZone: string): Date {
  return zonedWallClockToUtc(`${dateOnly}T00:00:00.000`, timeZone);
}

/**
 * Instants produced by the web forms: local noon converted to UTC. Noon is far
 * from both midnight boundaries, so a date never drifts when rendered back in
 * the same time zone.
 */
export function dateOnlyToUtcNoon(dateOnly: string, timeZone: string): Date {
  return zonedWallClockToUtc(`${dateOnly}T12:00:00.000`, timeZone);
}

/** Add whole days to a `YYYY-MM-DD` string without involving time zones. */
export function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) throw new Error(`Invalid date: "${dateOnly}"`);

  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** The last `count` months ending at `endMonth`, oldest first. */
export function trailingMonths(endMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addMonths(endMonth, index - count + 1));
}
