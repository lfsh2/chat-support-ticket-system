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
