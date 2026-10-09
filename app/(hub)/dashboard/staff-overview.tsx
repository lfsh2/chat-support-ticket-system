import Link from "next/link";
import { EmptyState } from "@/components/shell/empty-state";
import { UserAvatar } from "@/components/shell/user-avatar";
import { TaskLine } from "@/components/tasks/task-line";
import { PriorityTag, StatusDot } from "@/components/tickets/ticket-tags";
import { requireHubAccess } from "@/lib/session";
import { TASK_SELECT, compareTasks, dueState, type TaskRow } from "@/lib/tasks";
import { OPEN_STATUSES, TICKET_LIST_SELECT, sortQueue, type TicketListRow } from "@/lib/tickets";
import { dayKey, formatAge, safeTimeZone } from "@/lib/time";
import { Panel, Stat } from "./overview-bits";

/** The team's view: what needs a reply, and what's on your plate. */
export async function StaffOverview() {
  const { supabase, profile } = await requireHubAccess();
  const timeZone = safeTimeZone(profile.timezone);
  const today = dayKey(new Date(), timeZone);

  const [{ data: ticketData }, { data: taskData }] = await Promise.all([
    supabase.from("tickets").select(TICKET_LIST_SELECT).in("status", OPEN_STATUSES).limit(500),
    supabase.from("tasks").select(TASK_SELECT).in("status", ["todo", "in_progress"]).limit(500),
  ]);
  const tickets = (ticketData ?? []) as unknown as TicketListRow[];
  const tasks = (taskData ?? []) as unknown as TaskRow[];

  const needsReply = sortQueue(
    tickets.filter((t) => t.status === "new" || t.status === "open"),
    "open",
  );
  const myTasks = tasks.filter((t) => t.assignee_id === profile.id).sort(compareTasks);
  const overdue = tasks.filter((t) => dueState(t.due_on, today) === "overdue").length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4" role="group" aria-label="At a glance">
        <Stat value={tickets.filter((t) => t.status === "new").length} label="New tickets" href="/dashboard/tickets" tone="warn" />
        <Stat
          value={tickets.filter((t) => t.assignee_id === null).length}
          label="Unassigned"
          href="/dashboard/tickets?view=unassigned"
        />
        <Stat
          value={tickets.filter((t) => t.status === "waiting_on_client").length}
          label="Waiting on clients"
          href="/dashboard/tickets?view=waiting"
        />
        <Stat value={overdue} label="Overdue tasks" href="/dashboard/tasks" tone="alert" />
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr] lg:gap-12">
        <Panel title="Needs a reply" href="/dashboard/tickets" linkLabel="Full queue">
          {needsReply.length === 0 ? (
            <EmptyState title="Inbox zero.">No tickets are waiting on the team right now.</EmptyState>
          ) : (
            <ul>
              {needsReply.slice(0, 7).map((t) => (
                <li key={t.id} className="border-rule border-b last:border-0">
                  <Link
                    href={`/dashboard/tickets/${t.number}`}
                    className="hover:bg-muted/60 -mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 py-2"
                  >
                    <StatusDot status={t.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold">{t.subject}</span>
                        <PriorityTag priority={t.priority} />
                      </div>
                      <p className="text-muted-foreground truncate text-[13px]">
                        #{t.number} · {t.requester?.display_name ?? "Client"}
                        {t.status === "new" ? " · new" : ""}
                      </p>
                    </div>
                    {t.assignee ? (
                      <UserAvatar name={t.assignee.display_name} src={t.assignee.avatar_url} seed={t.assignee.id} className="size-6 text-[10px]" />
                    ) : (
                      <span className="text-muted-foreground hidden text-[12px] italic sm:inline">Unassigned</span>
                    )}
                    <span className="text-muted-foreground w-12 shrink-0 text-right text-xs tabular-nums">
                      {formatAge(new Date(t.updated_at ?? 0), timeZone)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Your tasks" href="/dashboard/tasks" linkLabel="Task board">
          {myTasks.length === 0 ? (
            <p className="text-muted-foreground py-3 text-[15px]">
              Nothing on your plate.{" "}
              <Link href="/dashboard/tasks" className="text-foreground font-semibold hover:underline">
                See the team&apos;s board
              </Link>
            </p>
          ) : (
            <div className="flex flex-col">
              {myTasks.slice(0, 7).map((t) => (
                <div key={t.id} className="border-rule border-b last:border-0">
                  <TaskLine task={t} today={today} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
