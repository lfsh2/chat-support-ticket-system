import type { Tables } from "@/lib/database.types";

/**
 * Month grids built from plain "YYYY-MM-DD" strings, so the server and browser always
 * agree on which day is which (no local-clock or timezone drift).
 */

export type CalendarEvent = Tables<"events">;
export const EVENT_SELECT = "id, title, description, program, starts_at, ends_at, link, created_by, created_at" as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && MONTH_RE.test(v);
}

/** "2026-10-09" → "2026-10" */
export function monthOf(day: string) {
  return day.slice(0, 7);
}

function toUtc(day: string) {
  return new Date(`${day}T00:00:00Z`);
}
function fromUtc(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number) {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return fromUtc(d).slice(0, 7);
}

/** The 42 days shown for a month: six Sunday-first weeks, so the grid never changes height. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const start = addDays(first, -toUtc(first).getUTCDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** "October 2026" */
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(toUtc(`${month}-01`));
}

/** "Thursday, October 9" for a date string. */
export function dayHeading(day: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(toUtc(day));
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
