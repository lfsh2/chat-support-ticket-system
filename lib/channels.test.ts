import { describe, expect, it } from "vitest";
import { toChannelName } from "./channels";

describe("toChannelName", () => {
  it("lowercases and joins words with dashes", () => {
    expect(toChannelName("  Support Email Ticket ")).toBe("support-email-ticket");
    expect(toChannelName("Casey Morgan's site")).toBe("casey-morgan-s-site");
  });

  it("drops a leading # and stray punctuation", () => {
    expect(toChannelName("#wins!!")).toBe("wins");
    expect(toChannelName("--a&f  updates--")).toBe("a-f-updates");
  });

  it("caps the length without leaving a trailing dash", () => {
    const name = toChannelName("a".repeat(39) + " b c");
    expect(name.length).toBeLessThanOrEqual(40);
    expect(name.endsWith("-")).toBe(false);
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(toChannelName("!!!")).toBe("");
  });
});
