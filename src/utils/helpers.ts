import type { MonthKey } from "../domain/types";

/** Generate a stable unique id. Uses crypto.randomUUID when available. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function now(): string {
  return new Date().toISOString();
}

/** "2026-10" for a given Date (local time). */
export function monthKeyOf(date: Date): MonthKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(new Date());
}

/** Shift a month key by `delta` months (negative = past). */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(date);
}

/** Previous month key, e.g. prevMonth("2026-01") === "2025-12". */
export function prevMonth(month: MonthKey): MonthKey {
  return addMonths(month, -1);
}

/** Human label, e.g. "October 2026". */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

/** List of month keys from `start` to `end` inclusive, oldest first. */
export function monthRange(start: MonthKey, end: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  let cur = start;
  // Guard against inverted ranges.
  if (start > end) return out;
  while (cur <= end) {
    out.push(cur);
    cur = addMonths(cur, 1);
    if (out.length > 600) break; // safety
  }
  return out;
}

/**
 * Assumed length of a working day, in hours. Single source of truth for all
 * hours↔days conversions (working-hours estimate, unbooked-days math).
 */
export const HOURS_PER_DAY = 8;

/** Number of working days (Mon–Fri) in a given month. */
export function businessDays(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(y, m - 1, d).getDay(); // 0 = Sun, 6 = Sat
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}

/** Working hours in a month, assuming a standard working day. */
export function businessHours(
  month: MonthKey,
  hoursPerDay = HOURS_PER_DAY
): number {
  return businessDays(month) * hoursPerDay;
}

/** The single currency used throughout the app. */
export const CURRENCY = "EUR";

export function formatMoney(amount: number, currency: string = CURRENCY): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
