import { describe, expect, it } from "vitest";
import { dayKey, dayLabel, formatTime, formatTimeShort, safeTimeZone } from "./time";

describe("time formatting is timezone-explicit", () => {
  const d = new Date("2026-09-30T03:30:00Z");

  it("formats the same instant differently per zone, identically on any machine", () => {
    expect(formatTime(d, "UTC")).toBe("3:30 AM");
    expect(formatTime(d, "America/New_York")).toBe("11:30 PM");
    expect(formatTimeShort(d, "America/New_York")).toBe("11:30");
  });

  it("puts the instant on the right calendar day for the zone", () => {
    expect(dayKey(d, "UTC")).toBe("2026-09-30");
    expect(dayKey(d, "America/New_York")).toBe("2026-09-29");
  });

  it("labels today / yesterday relative to the zone", () => {
    const now = new Date("2026-09-30T15:00:00Z");
    expect(dayLabel(d, "UTC", now)).toBe("Today");
    expect(dayLabel(d, "America/New_York", now)).toBe("Yesterday");
    expect(dayLabel(new Date("2026-09-14T15:00:00Z"), "UTC", now)).toBe("Monday, September 14");
  });

  it("falls back for missing or bogus zones", () => {
    expect(safeTimeZone(null)).toBe("America/New_York");
    expect(safeTimeZone("Mars/Olympus")).toBe("America/New_York");
  });
});
