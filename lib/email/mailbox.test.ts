import { describe, expect, it } from "vitest";
import { pickMailbox, ticketProgram, type Mailbox } from "./mailbox";

const coachos: Mailbox = { email: "coachos@aliveandfreeconsulting.com", program: "coachos", channelId: "c1" };
const support: Mailbox = { email: "support@aliveandfreeconsulting.com", program: "alive_free", channelId: "c2" };

describe("pickMailbox", () => {
  it("answers from the mailbox the client wrote to", () => {
    expect(pickMailbox([coachos, support], { program: "coachos", threadMailbox: "Support@AliveAndFreeConsulting.com" })).toBe(support);
  });

  it("uses the program's mailbox for tickets that started on the web", () => {
    expect(pickMailbox([coachos, support], { program: "alive_free", threadMailbox: null })).toBe(support);
    expect(pickMailbox([coachos, support], { program: "coachos", threadMailbox: null })).toBe(coachos);
  });

  it("falls back to the first mailbox when the thread's or program's isn't connected", () => {
    expect(pickMailbox([coachos], { program: "alive_free", threadMailbox: "support@aliveandfreeconsulting.com" })).toBe(coachos);
  });

  it("returns null with no mailbox connected", () => {
    expect(pickMailbox([], { program: "coachos", threadMailbox: null })).toBeNull();
  });
});

describe("ticketProgram", () => {
  it("prefers the mailbox's program when the client has it", () => {
    expect(ticketProgram(["coachos", "alive_free"], "alive_free")).toBe("alive_free");
  });

  it("otherwise uses CoachOS, then whatever they have", () => {
    expect(ticketProgram(["coachos"], "alive_free")).toBe("coachos");
    expect(ticketProgram(["alive_free"], null)).toBe("alive_free");
    expect(ticketProgram(["coachos", "alive_free"], null)).toBe("coachos");
  });

  it("is null for someone without live access", () => {
    expect(ticketProgram([], "coachos")).toBeNull();
  });
});
