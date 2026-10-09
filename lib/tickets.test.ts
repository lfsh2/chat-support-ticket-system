import { describe, expect, it } from "vitest";
import { friendlyTicketError, isOpenStatus, parseQueueView, sortQueue, waitingTooLong } from "./tickets";

describe("sortQueue", () => {
  const row = (priority: "normal" | "high" | "urgent", updated_at: string) => ({ priority, updated_at, status: "open" as const });
  const rows = [row("normal", "2026-10-09T10:00:00Z"), row("high", "2026-10-09T12:00:00Z"), row("normal", "2026-10-08T10:00:00Z")];

  it("works the queue by priority, then longest waiting", () => {
    expect(sortQueue(rows, "open").map((r) => [r.priority, r.updated_at.slice(5, 10)])).toEqual([
      ["high", "10-09"],
      ["normal", "10-08"],
      ["normal", "10-09"],
    ]);
  });
  it("shows resolved tickets newest first", () => {
    expect(sortQueue(rows, "resolved")[0].updated_at).toBe("2026-10-09T12:00:00Z");
  });
});

describe("helpers", () => {
  it("knows which statuses are open", () => {
    expect(isOpenStatus("waiting_on_client")).toBe(true);
    expect(isOpenStatus("resolved")).toBe(false);
  });
  it("falls back to the open view for unknown input", () => {
    expect(parseQueueView("mine")).toBe("mine");
    expect(parseQueueView("constructor")).toBe("open");
    expect(parseQueueView(undefined)).toBe("open");
  });
  it("flags tickets untouched for over a day", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    expect(waitingTooLong("2026-10-08T11:00:00Z", now)).toBe(true);
    expect(waitingTooLong("2026-10-08T13:00:00Z", now)).toBe(false);
  });
  it("passes rate-limit messages through and hides raw errors", () => {
    expect(friendlyTicketError({ hint: "rate_limited", message: "Slow down a little." })).toBe("Slow down a little.");
    expect(friendlyTicketError({ message: "duplicate key value violates…" })).toMatch(/couldn't open your ticket/);
  });
});
