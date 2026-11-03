import { stripMentions } from "@/lib/mentions";
import { toPlainText } from "@/lib/markdown";

export type NotificationType = "mention" | "thread_reply" | "ticket_update";

/** A notification row as the Inbox loads it (the embedded message is null when it's gone or hidden). */
export type InboxItem = {
  id: string;
  type: string;
  read_at: string | null;
  created_at: string | null;
  message: {
    id: string;
    body: string;
    kind: string;
    parent_id: string | null;
    deleted_at: string | null;
    author: { id: string; display_name: string; avatar_url: string | null } | null;
    channel: { slug: string; name: string } | null;
  } | null;
  ticket: { number: number; subject: string } | null;
};

export const INBOX_SELECT =
  "id, type, read_at, created_at, message:messages!notifications_message_id_fkey(id, body, kind, parent_id, deleted_at, author:profiles!messages_author_id_fkey(id, display_name, avatar_url), channel:channels!messages_channel_id_fkey(slug, name)), ticket:tickets!notifications_ticket_id_fkey(number, subject)" as const;

export const INBOX_LIMIT = 100;

/** Where tapping the notification goes: the exact message, highlighted. */
export function inboxHref(item: InboxItem): string | null {
  const m = item.message;
  if (item.ticket) return `/dashboard/tickets/${item.ticket.number}${m ? `?m=${m.id}` : ""}`;
  if (!m?.channel) return null;
  if (m.parent_id) return `/c/${m.channel.slug}/t/${m.parent_id}?m=${m.id}`;
  return `/c/${m.channel.slug}?m=${m.id}`;
}

/** "Jon (Support)" → "Jon": the role in brackets is noise in a one-line summary. */
const shortName = (name: string) => name.replace(/\s*\(.*?\)\s*/g, " ").trim() || name;

/** "Jon mentioned you in #general", "Jon replied on #1042 · Domain help", … */
export function inboxTitle(item: InboxItem): { who: string; what: string } {
  const who = item.message?.author ? shortName(item.message.author.display_name) : "The team";
  const where = item.ticket
    ? `ticket #${item.ticket.number}`
    : item.message?.channel
      ? `#${item.message.channel.name}`
      : "a conversation";
  const m = item.message;
  switch (item.type) {
    case "mention":
      return { who, what: `mentioned you in ${where}` };
    case "thread_reply":
      return { who, what: `replied to a thread in ${where}` };
    default:
      if (m?.kind === "system") return { who, what: `${m.body.replace(/^marked this /, "marked it ")} · ${where}` };
      return { who, what: `replied on ${where}` };
  }
}

/** One-line preview of the message (empty for system events and deleted messages). */
export function inboxPreview(item: InboxItem): string {
  const m = item.message;
  if (!m || m.kind === "system") return "";
  if (m.deleted_at) return "This message was deleted.";
  return toPlainText(stripMentions(m.body)) || "Sent an attachment";
}

/** Rows we can show: the message still exists and the reader can see it. */
export function visibleItems(rows: InboxItem[]): InboxItem[] {
  return rows.filter((r) => r.message !== null);
}
