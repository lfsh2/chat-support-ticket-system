import { describe, expect, it } from "vitest";
import { activePrograms, canSignIn, membershipGrantsAccess, normalizeEmail } from "./access";

const now = new Date("2026-09-30T12:00:00Z");

describe("membershipGrantsAccess", () => {
  it("allows active and manual memberships", () => {
    expect(membershipGrantsAccess({ status: "active", grace_until: null, program: "coachos" }, now)).toBe(true);
    expect(membershipGrantsAccess({ status: "manual", grace_until: null, program: "coachos" }, now)).toBe(true);
  });

  it("allows past_due only while inside the grace period", () => {
    const inGrace = { status: "past_due" as const, grace_until: "2026-10-02T00:00:00Z", program: "coachos" as const };
    const expired = { ...inGrace, grace_until: "2026-09-29T00:00:00Z" };
    expect(membershipGrantsAccess(inGrace, now)).toBe(true);
    expect(membershipGrantsAccess(expired, now)).toBe(false);
  });

  it("blocks canceled memberships without grace", () => {
    expect(membershipGrantsAccess({ status: "canceled", grace_until: null, program: "alive_free" }, now)).toBe(false);
  });
});

describe("activePrograms", () => {
  it("returns each live program once", () => {
    expect(
      activePrograms(
        [
          { status: "active", grace_until: null, program: "coachos" },
          { status: "manual", grace_until: null, program: "alive_free" },
          { status: "canceled", grace_until: null, program: "coachos" },
        ],
        now,
      ).sort(),
    ).toEqual(["alive_free", "coachos"]);
  });
});

describe("canSignIn", () => {
  it("lets staff in without a membership", () => {
    expect(canSignIn([], "agent", now)).toBe(true);
    expect(canSignIn([], "owner", now)).toBe(true);
  });

  it("blocks members with nothing live", () => {
    expect(canSignIn([], "member", now)).toBe(false);
    expect(canSignIn([], null, now)).toBe(false);
    expect(canSignIn([{ status: "canceled", grace_until: null, program: "coachos" }], "member", now)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Casey@Example.COM ")).toBe("casey@example.com");
  });
});
