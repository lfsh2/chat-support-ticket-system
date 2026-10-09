/**
 * Timezone-explicit formatting. Server (UTC) and browser (local) must render identical
 * text or React hydration breaks, so everything is formatted in the member's profile
 * timezone rather than whatever clock the code happens to run on.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, ...options });
    cache.set(key, f);
  }
  return f;
}

/** "3:05 PM" */
export function formatTime(date: Date, timeZone: string) {
  return fmt(timeZone, { hour: "numeric", minute: "2-digit" }).format(date);
}

/** "3:05" — compact, for continuation rows. */
export function formatTimeShort(date: Date, timeZone: string) {
  return formatTime(date, timeZone).replace(/\s?[AP]M$/i, "");
}

/** Calendar day in the given zone, e.g. "2026-09-30". */
export function dayKey(date: Date, timeZone: string) {
  const parts = fmt(timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Today", "Yesterday", "Monday, September 28", or with a year if not this year. */
export function dayLabel(date: Date, timeZone: string, now = new Date()) {
  const key = dayKey(date, timeZone);
  if (key === dayKey(now, timeZone)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Yesterday";
  const sameYear = key.slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
  return fmt(timeZone, { weekday: "long", month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(date);
}

export const DEFAULT_TIMEZONE = "America/New_York";

export function safeTimeZone(tz: string | null | undefined) {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Compact age for lists: "just now", "12m", "3h", "2d", then "Sep 28". */
export function formatAge(date: Date, timeZone: string, now = new Date()) {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return fmt(timeZone, { month: "short", day: "numeric" }).format(date);
}

/** "Good morning" / "Good afternoon" / "Good evening" in the viewer's timezone. */
export function greeting(date: Date, timeZone: string) {
  const hour = Number(fmt(timeZone, { hour: "numeric", hourCycle: "h23" }).format(date));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "Thursday, October 9" */
export function longDate(date: Date, timeZone: string) {
  return fmt(timeZone, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. -240 for New York in summer). */
function tzOffsetMinutes(date: Date, timeZone: string) {
  const parts = fmt(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Wall-clock "2026-10-09" + "15:30" in `timeZone` → the real instant (DST-safe). */
export function zonedToUtc(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffsetMinutes(new Date(guess), timeZone) * 60_000;
  // Re-check with the offset at the candidate instant, in case we crossed a DST change.
  return new Date(guess - tzOffsetMinutes(new Date(first), timeZone) * 60_000);
}

/** "15:30" in the zone, for filling a time input. */
export function timeKey(date: Date, timeZone: string) {
  return fmt(timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
