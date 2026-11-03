import { describe, expect, it } from "vitest";
import { inboxHref, inboxPreview, inboxTitle, visibleItems, type InboxItem } from "./inbox";

const author = { id: "a", display_name: "Jon (Support)", avatar_url: null };
type Msg = NonNullable<InboxItem["message"]>;
const base = (over: Omit<Partial<InboxItem>, "message"> & { message?: Partial<Msg> | null }): InboxItem => {
  const { message, ...rest } = over;
  return {
    id: "n1",
    type: "mention",
    read_at: null,
    created_at: "2026-11-03T10:00:00Z",
    ticket: null,
    ...rest,
    message:
      message === null
        ? null
        : {
            id: "m1",
            body: "hi @[Casey](user:00000000-0000-4000-a000-000000000001) **look**",
            kind: "user",
            parent_id: null,
            deleted_at: null,
            author,
            channel: { slug: "general", name: "general" },
            ...message,
          },
  };
};

describe("inboxHref", () => {
  it("links channel messages, thread replies and tickets to the exact message", () => {
    expect(inboxHref(base({}))).toBe("/c/general?m=m1");
    expect(inboxHref(base({ type: "thread_reply", message: { parent_id: "p1" } }))).toBe("/c/general/t/p1?m=m1");
    expect(inboxHref(base({ type: "ticket_update", ticket: { number: 1042, subject: "Domain" }, message: { channel: null } }))).toBe(
      "/dashboard/tickets/1042?m=m1",
    );
  });
});

describe("inboxTitle", () => {
  it("says who did what, where", () => {
    expect(inboxTitle(base({}))).toEqual({ who: "Jon", what: "mentioned you in #general" });
    expect(inboxTitle(base({ type: "thread_reply" })).what).toBe("replied to a thread in #general");
    const ticket = { number: 1042, subject: "Domain" };
    expect(inboxTitle(base({ type: "ticket_update", ticket, message: { channel: null } })).what).toBe("replied on ticket #1042");
    expect(
      inboxTitle(base({ type: "ticket_update", ticket, message: { channel: null, kind: "system", body: "marked this resolved" } })).what,
    ).toBe("marked it resolved · ticket #1042");
  });
});

describe("inboxPreview", () => {
  it("shows plain text with names, not markup", () => {
    expect(inboxPreview(base({}))).toBe("hi @Casey look");
    expect(inboxPreview(base({ message: { deleted_at: "x", body: "" } }))).toBe("This message was deleted.");
  });
});

describe("visibleItems", () => {
  it("drops notifications whose message is gone or hidden", () => {
    expect(visibleItems([base({}), base({ id: "n2", message: null })]).map((i) => i.id)).toEqual(["n1"]);
  });
});
