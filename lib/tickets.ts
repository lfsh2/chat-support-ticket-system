import type { Enums, Tables } from "@/lib/database.types";

export type TicketStatus = Enums<"ticket_status">;
export type TicketPriority = Enums<"ticket_priority">;
export type TicketCategory = Enums<"ticket_category">;

export const OPEN_STATUSES: TicketStatus[] = ["new", "open", "waiting_on_client"];
export const DONE_STATUSES: TicketStatus[] = ["resolved", "closed"];

export function isOpenStatus(status: TicketStatus) {
  return OPEN_STATUSES.includes(status);
}

/** Staff see the queue's words; clients see plain ones ("Waiting on you"). */
export const STATUS_META: Record<TicketStatus, { label: string; memberLabel: string; dot: string; text: string }> = {
  new: { label: "New", memberLabel: "Sent", dot: "bg-ink", text: "text-foreground" },
  open: { label: "Open", memberLabel: "In progress", dot: "border-ink border-[1.5px] bg-transparent", text: "text-foreground" },
  waiting_on_client: { label: "Waiting on client", memberLabel: "Waiting on you", dot: "bg-warning", text: "text-warning" },
  resolved: { label: "Resolved", memberLabel: "Resolved", dot: "bg-success", text: "text-success" },
  closed: { label: "Closed", memberLabel: "Closed", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

export const STATUS_ORDER: TicketStatus[] = ["new", "open", "waiting_on_client", "resolved", "closed"];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  tech: "Tech / CoachOS setup",
  website_domain: "Website & domain",
  billing: "Billing",
  coaching: "Coaching",
  other: "Something else",
};
export const CATEGORY_ORDER: TicketCategory[] = ["tech", "website_domain", "billing", "coaching", "other"];

export const PRIORITY_LABEL: Record<TicketPriority, string> = { normal: "Normal", high: "High", urgent: "Urgent" };
export const PRIORITY_ORDER: TicketPriority[] = ["normal", "high", "urgent"];
export const PRIORITY_RANK: Record<TicketPriority, number> = { normal: 0, high: 1, urgent: 2 };

type Person = Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url">;

export const TICKET_LIST_SELECT =
  "id, number, subject, status, priority, program, category, created_at, updated_at, requester_id, assignee_id, requester:profiles!tickets_requester_id_fkey(id, display_name, avatar_url), assignee:profiles!tickets_assignee_id_fkey(id, display_name, avatar_url)" as const;

export type TicketListRow = Pick<
  Tables<"tickets">,
  | "id"
  | "number"
  | "subject"
  | "status"
  | "priority"
  | "program"
  | "category"
  | "created_at"
  | "updated_at"
  | "requester_id"
  | "assignee_id"
> & { requester: Person | null; assignee: Person | null };

/** Queue views for staff. "open" is the default working view. */
export const QUEUE_VIEWS = {
  open: { label: "All open", statuses: OPEN_STATUSES },
  mine: { label: "Assigned to me", statuses: OPEN_STATUSES },
  unassigned: { label: "Unassigned", statuses: OPEN_STATUSES },
  waiting: { label: "Waiting on client", statuses: ["waiting_on_client"] as TicketStatus[] },
  resolved: { label: "Resolved", statuses: DONE_STATUSES },
} as const;
export type QueueView = keyof typeof QUEUE_VIEWS;

export function parseQueueView(v: unknown): QueueView {
  return typeof v === "string" && Object.hasOwn(QUEUE_VIEWS, v) ? (v as QueueView) : "open";
}

/**
 * Queue order: urgent first, then whoever has waited longest. Resolved tickets are
 * history, so newest first.
 */
export function sortQueue<T extends Pick<TicketListRow, "priority" | "updated_at" | "status">>(rows: T[], view: QueueView): T[] {
  const at = (r: T) => new Date(r.updated_at ?? 0).getTime();
  if (view === "resolved") return [...rows].sort((a, b) => at(b) - at(a));
  return [...rows].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || at(a) - at(b));
}

/** Open for more than a day without movement — worth flagging in the queue. */
export function waitingTooLong(updatedAt: string | null, now = Date.now()) {
  return now - new Date(updatedAt ?? 0).getTime() > 86_400_000;
}

/** Postgres error → something a person can act on. */
export function friendlyTicketError(error: { message?: string; hint?: string; code?: string } | null | undefined) {
  if (error?.hint === "rate_limited" && error.message) return error.message;
  if (error?.code === "42501") return "You don't have access to that program. Pick another, or email us if that's wrong.";
  return "We couldn't open your ticket just now. Check your connection and try again.";
}
