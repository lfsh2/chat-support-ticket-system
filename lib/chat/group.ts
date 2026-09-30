import { dayKey } from "@/lib/time";
import type { ChatMessage } from "./types";

export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type ListItem =
  | { type: "date"; key: string; date: Date }
  | { type: "unread"; key: "unread" }
  | { type: "message"; key: string; message: ChatMessage; isGroupStart: boolean };

/**
 * Turns messages (oldest first) into render rows: date separators, the "New messages"
 * divider, and author groups (same author, within 5 minutes, same day, no divider between).
 */
export function buildListItems(
  messages: ChatMessage[],
  opts: { unreadAfter?: Date | null; currentUserId?: string; timeZone?: string } = {},
): ListItem[] {
  const tz = opts.timeZone ?? "UTC";
  const items: ListItem[] = [];
  let prev: ChatMessage | undefined;
  let unreadPlaced = false;

  for (const msg of messages) {
    const at = new Date(msg.created_at ?? 0);
    const prevAt = prev ? new Date(prev.created_at ?? 0) : undefined;
    let breakGroup = !prev;

    if (!prevAt || dayKey(prevAt, tz) !== dayKey(at, tz)) {
      items.push({ type: "date", key: `date-${dayKey(at, tz)}`, date: at });
      breakGroup = true;
    }

    if (
      !unreadPlaced &&
      opts.unreadAfter &&
      at > opts.unreadAfter &&
      msg.author_id !== opts.currentUserId &&
      !msg.status
    ) {
      items.push({ type: "unread", key: "unread" });
      unreadPlaced = true;
      breakGroup = true;
    }

    if (
      !breakGroup &&
      prev &&
      prevAt &&
      (prev.author_id !== msg.author_id ||
        prev.kind !== "user" ||
        msg.kind !== "user" ||
        prev.deleted_at != null ||
        at.getTime() - prevAt.getTime() > GROUP_WINDOW_MS)
    ) {
      breakGroup = true;
    }

    items.push({ type: "message", key: msg.id, message: msg, isGroupStart: breakGroup });
    prev = msg;
  }
  return items;
}
