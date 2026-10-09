import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shell/empty-state";
import { UserAvatar } from "@/components/shell/user-avatar";
import { PriorityTag, ProgramTag, StatusBadge, StatusDot } from "@/components/tickets/ticket-tags";
import { requireHubAccess } from "@/lib/session";
import { formatAge, safeTimeZone } from "@/lib/time";
import {
  CATEGORY_LABEL,
  DONE_STATUSES,
  OPEN_STATUSES,
  QUEUE_VIEWS,
  TICKET_LIST_SELECT,
  sortQueue,
  waitingTooLong,
  type QueueView,
  type TicketListRow,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { QueueFilters } from "./queue-filters";

/** The team's ticket queue: view chips, program/priority filters, oldest-waiting first. */
export async function StaffQueue({ view, program, priority }: { view: QueueView; program?: string; priority?: string }) {
  const { supabase, profile } = await requireHubAccess();
  const timeZone = safeTimeZone(profile.timezone);

  const [{ data: openData }, { data: doneData }] = await Promise.all([
    supabase.from("tickets").select(TICKET_LIST_SELECT).in("status", OPEN_STATUSES).limit(500),
    view === "resolved"
      ? supabase
          .from("tickets")
          .select(TICKET_LIST_SELECT)
          .in("status", DONE_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const openTickets = (openData ?? []) as unknown as TicketListRow[];

  const inView: Record<QueueView, (t: TicketListRow) => boolean> = {
    open: () => true,
    mine: (t) => t.assignee_id === profile.id,
    unassigned: (t) => t.assignee_id === null,
    waiting: (t) => t.status === "waiting_on_client",
    resolved: () => true,
  };
  const counts = Object.fromEntries(
    (Object.keys(QUEUE_VIEWS) as QueueView[]).map((v) => [v, v === "resolved" ? null : openTickets.filter(inView[v]).length]),
  ) as Record<QueueView, number | null>;

  const base = view === "resolved" ? ((doneData ?? []) as unknown as TicketListRow[]) : openTickets.filter(inView[view]);
  const rows = sortQueue(
    base.filter((t) => (!program || t.program === program) && (!priority || t.priority === priority)),
    view,
  );

  return (
    <div className="flex flex-col">
      <QueueFilters view={view} program={program} priority={priority} counts={counts} />

      {rows.length === 0 ? (
        <EmptyState eyebrow={QUEUE_VIEWS[view].label} title={view === "resolved" ? "Nothing resolved yet." : "All caught up."}>
          {view === "resolved"
            ? "Resolved tickets show up here, newest first."
            : "No tickets match these filters. Nice work — or try clearing a filter."}
        </EmptyState>
      ) : (
        <>
          {/* Phones: a list of rows. */}
          <ul className="border-rule border-t md:hidden">
            {rows.map((t) => (
              <li key={t.id} className="border-rule border-b">
                <Link href={`/dashboard/tickets/${t.number}`} className="hover:bg-muted/60 flex items-start gap-3 px-4 py-3.5">
                  <StatusDot status={t.status} className="mt-[7px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{t.subject}</span>
                      <PriorityTag priority={t.priority} />
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-[13px]">
                      #{t.number} · {t.requester?.display_name ?? "Client"} · {CATEGORY_LABEL[t.category]}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <StatusBadge status={t.status} />
                      <ProgramTag program={t.program} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatAge(new Date(t.updated_at ?? 0), timeZone)}
                    </span>
                    {t.assignee ? (
                      <UserAvatar name={t.assignee.display_name} src={t.assignee.avatar_url} seed={t.assignee.id} className="size-6 text-[10px]" />
                    ) : (
                      <span className="text-muted-foreground text-[11px] italic">Unassigned</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet and up: a table. The subject link stretches across the row. */}
          <Table className="hidden table-fixed md:table">
            <TableHeader>
              <TableRow className="border-rule hover:bg-transparent">
                <TableHead className="text-muted-foreground w-20 pl-6 text-xs font-semibold">#</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold">Subject</TableHead>
                <TableHead className="text-muted-foreground w-[22%] text-xs font-semibold">Client</TableHead>
                <TableHead className="text-muted-foreground w-36 text-xs font-semibold">Status</TableHead>
                <TableHead className="text-muted-foreground hidden w-40 text-xs font-semibold lg:table-cell">Assignee</TableHead>
                <TableHead className="text-muted-foreground w-24 pr-6 text-right text-xs font-semibold">
                  {view === "resolved" ? "Updated" : "Waiting"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="border-rule hover:bg-muted/60 relative">
                  <TableCell className="text-muted-foreground pl-6 align-top tabular-nums">{t.number}</TableCell>
                  <TableCell className="align-top">
                    <Link
                      href={`/dashboard/tickets/${t.number}`}
                      className="focus-visible:ring-ring flex items-center gap-2 outline-none after:absolute after:inset-0 focus-visible:ring-2"
                    >
                      <span className="truncate text-[15px] font-semibold">{t.subject}</span>
                      <PriorityTag priority={t.priority} />
                    </Link>
                    <div className="mt-1 flex items-center gap-3">
                      <ProgramTag program={t.program} />
                      <span className="text-muted-foreground text-[13px]">{CATEGORY_LABEL[t.category]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="flex min-w-0 items-center gap-2">
                      <UserAvatar
                        name={t.requester?.display_name ?? "Client"}
                        src={t.requester?.avatar_url}
                        seed={t.requester_id}
                        className="size-6 text-[10px]"
                      />
                      <span className="truncate">{t.requester?.display_name ?? "Client"}</span>
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="hidden align-top lg:table-cell">
                    {t.assignee ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar name={t.assignee.display_name} src={t.assignee.avatar_url} seed={t.assignee.id} className="size-6 text-[10px]" />
                        <span className="truncate">{t.assignee.id === profile.id ? "You" : t.assignee.display_name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-6 text-right align-top tabular-nums",
                      view !== "resolved" && waitingTooLong(t.updated_at)
                        ? "text-warning font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatAge(new Date(t.updated_at ?? 0), timeZone)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
