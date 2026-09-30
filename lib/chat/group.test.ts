import { describe, expect, it } from "vitest";
import { buildListItems } from "./group";
import type { ChatMessage } from "./types";

let n = 0;
function msg(author: string, iso: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  n++;
  return {
    id: `m${n}`,
    channel_id: "c",
    ticket_id: null,
    parent_id: null,
    author_id: author,
    kind: "user",
    body: "hi",
    attachments: [],
    via: "web",
    reply_count: 0,
    edited_at: null,
    deleted_at: null,
    created_at: iso,
    author: null,
    reactions: [],
    ...extra,
  };
}

const shape = (items: ReturnType<typeof buildListItems>) =>
  items.map((i) => (i.type === "message" ? (i.isGroupStart ? "start" : "cont") : i.type));

describe("buildListItems", () => {
  it("groups the same author within 5 minutes", () => {
    const items = buildListItems([
      msg("a", "2026-09-30T10:00:00Z"),
      msg("a", "2026-09-30T10:04:00Z"),
      msg("a", "2026-09-30T10:10:00Z"),
      msg("b", "2026-09-30T10:11:00Z"),
    ]);
    expect(shape(items)).toEqual(["date", "start", "cont", "start", "start"]);
  });

  it("adds a date separator when the day changes", () => {
    const items = buildListItems([msg("a", "2026-09-29T12:00:00Z"), msg("a", "2026-09-30T12:01:00Z")]);
    expect(shape(items)).toEqual(["date", "start", "date", "start"]);
  });

  it("places the unread divider once, before the first unread message from someone else", () => {
    const items = buildListItems(
      [
        msg("a", "2026-09-30T10:00:00Z"),
        msg("me", "2026-09-30T10:02:00Z"),
        msg("a", "2026-09-30T10:03:00Z"),
        msg("a", "2026-09-30T10:04:00Z"),
      ],
      { unreadAfter: new Date("2026-09-30T10:01:00Z"), currentUserId: "me" },
    );
    expect(shape(items)).toEqual(["date", "start", "start", "unread", "start", "cont"]);
  });

  it("does not group after a deleted message", () => {
    const items = buildListItems([
      msg("a", "2026-09-30T10:00:00Z", { deleted_at: "2026-09-30T10:00:30Z" }),
      msg("a", "2026-09-30T10:01:00Z"),
    ]);
    expect(shape(items)).toEqual(["date", "start", "start"]);
  });
});
