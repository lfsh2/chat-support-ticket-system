import { describe, expect, it } from "vitest";
import { addDays, isMonthKey, monthGrid, monthLabel, shiftMonth } from "./calendar";

describe("calendar grid", () => {
  it("starts on the Sunday before the 1st and always shows six weeks", () => {
    const grid = monthGrid("2026-10"); // Oct 1 2026 is a Thursday
    expect(grid[0]).toBe("2026-09-27");
    expect(grid).toHaveLength(42);
    expect(grid).toContain("2026-10-31");
    expect(grid[grid.length - 1]).toBe("2026-11-07");
  });
  it("starts on the 1st itself when it's a Sunday", () => {
    expect(monthGrid("2026-02")[0]).toBe("2026-02-01");
  });
  it("shifts months across years and handles leap days", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("labels and validates month keys", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-07")).toBe(true);
  });
});
