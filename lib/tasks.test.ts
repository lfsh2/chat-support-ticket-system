import { describe, expect, it } from "vitest";
import { compareTasks, dueState, formatDue, sortColumn } from "./tasks";

const t = (o: Partial<{ priority: "normal" | "high" | "urgent"; due_on: string | null; created_at: string; completed_at: string | null }>) => ({
  priority: "normal" as const,
  due_on: null,
  created_at: "2026-10-01T00:00:00Z",
  completed_at: null,
  ...o,
});

describe("dueState", () => {
  const today = "2026-10-09";
  it("is null without a due date", () => expect(dueState(null, today)).toBeNull());
  it("flags overdue, today, soon and later", () => {
    expect(dueState("2026-10-08", today)).toBe("overdue");
    expect(dueState("2026-10-09", today)).toBe("today");
    expect(dueState("2026-10-11", today)).toBe("soon");
    expect(dueState("2026-10-12", today)).toBe("later");
  });
  it("handles month and year boundaries", () => {
    expect(dueState("2026-12-31", "2027-01-01")).toBe("overdue");
    expect(dueState("2026-11-01", "2026-10-31")).toBe("soon");
  });
});

describe("formatDue", () => {
  const today = "2026-10-09";
  it("uses words for nearby days", () => {
    expect(formatDue("2026-10-09", today)).toBe("Today");
    expect(formatDue("2026-10-10", today)).toBe("Tomorrow");
    expect(formatDue("2026-10-08", today)).toBe("Yesterday");
  });
  it("shows the date otherwise, with the year only when it differs", () => {
    expect(formatDue("2026-10-16", today)).toBe("Fri, Oct 16");
    expect(formatDue("2027-01-05", today)).toBe("Tue, Jan 5, 2027");
  });
  it("doesn't drift across timezones (date-only values)", () => {
    expect(formatDue("2026-03-08", "2026-03-01")).toBe("Sun, Mar 8");
  });
});

describe("compareTasks / sortColumn", () => {
  it("puts urgent first, then soonest due, undated last, then oldest", () => {
    const list = [
      t({ due_on: null, created_at: "2026-10-01T00:00:00Z" }),
      t({ due_on: "2026-10-12" }),
      t({ due_on: "2026-10-10" }),
      t({ priority: "urgent", due_on: "2026-10-20" }),
      t({ due_on: null, created_at: "2026-09-01T00:00:00Z" }),
    ];
    const sorted = [...list].sort(compareTasks);
    expect(sorted.map((x) => [x.priority, x.due_on, x.created_at.slice(0, 7)])).toEqual([
      ["urgent", "2026-10-20", "2026-10"],
      ["normal", "2026-10-10", "2026-10"],
      ["normal", "2026-10-12", "2026-10"],
      ["normal", null, "2026-09"],
      ["normal", null, "2026-10"],
    ]);
  });
  it("orders the done column by most recently finished", () => {
    const done = sortColumn(
      [t({ completed_at: "2026-10-01T10:00:00Z" }), t({ completed_at: "2026-10-05T10:00:00Z" })],
      "done",
    );
    expect(done[0].completed_at).toBe("2026-10-05T10:00:00Z");
  });
});
