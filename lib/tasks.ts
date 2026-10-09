import type { Enums, Tables } from "@/lib/database.types";
import { PRIORITY_RANK } from "@/lib/tickets";

export type TaskStatus = Enums<"task_status">;

export const TASK_COLUMNS: { status: TaskStatus; label: string; empty: string }[] = [
  { status: "todo", label: "To do", empty: "Nothing waiting. Add a task when something comes up." },
  { status: "in_progress", label: "In progress", empty: "Drag a task here when you start on it." },
  { status: "done", label: "Done", empty: "Finished tasks land here." },
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

type Person = Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url">;

export const TASK_SELECT =
  "*, assignee:profiles!tasks_assignee_id_fkey(id, display_name, avatar_url), ticket:tickets!tasks_ticket_id_fkey(id, number, subject)" as const;

export type TaskRow = Tables<"tasks"> & {
  assignee: Person | null;
  ticket: Pick<Tables<"tickets">, "id" | "number" | "subject"> | null;
};

/** Within a column: urgent first, then soonest due (undated last), then oldest. */
export function compareTasks(
  a: Pick<TaskRow, "priority" | "due_on" | "created_at">,
  b: Pick<TaskRow, "priority" | "due_on" | "created_at">,
) {
  return (
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
    (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31") ||
    a.created_at.localeCompare(b.created_at)
  );
}

/** Done tasks are history: most recently finished first. */
export function sortColumn<T extends Pick<TaskRow, "priority" | "due_on" | "created_at" | "completed_at">>(
  tasks: T[],
  status: TaskStatus,
): T[] {
  if (status === "done") return [...tasks].sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  return [...tasks].sort(compareTasks);
}

export type DueState = "overdue" | "today" | "soon" | "later";

/** `today` is the viewer's calendar day ("2026-10-09"), so this is timezone-safe. */
export function dueState(dueOn: string | null, today: string): DueState | null {
  if (!dueOn) return null;
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "today";
  return daysBetween(today, dueOn) <= 2 ? "soon" : "later";
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "Today", "Tomorrow", "Yesterday", "Fri, Oct 10" (+ year when it's not this year). */
export function formatDue(dueOn: string, today: string) {
  const diff = daysBetween(today, dueOn);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = new Date(`${dueOn}T12:00:00Z`);
  const sameYear = dueOn.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}
