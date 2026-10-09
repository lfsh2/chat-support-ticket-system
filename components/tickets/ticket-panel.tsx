"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/shell/user-avatar";
import { useHub } from "@/components/shell/hub-context";
import { TaskDialog, type StaffOption } from "@/components/tasks/task-dialog";
import { TaskLine } from "@/components/tasks/task-line";
import { updateTicket } from "@/app/(hub)/dashboard/tickets/actions";
import { membershipGrantsAccess, type Program } from "@/lib/access";
import { PROGRAMS } from "@/lib/config";
import type { Tables } from "@/lib/database.types";
import type { TaskRow } from "@/lib/tasks";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_META, STATUS_ORDER, type TicketPriority, type TicketStatus } from "@/lib/tickets";
import { StatusDot } from "./ticket-tags";

export type TicketPanelData = {
  ticket: Pick<Tables<"tickets">, "id" | "number" | "subject" | "status" | "priority" | "assignee_id">;
  requester: { id: string; display_name: string; avatar_url: string | null; email: string } | null;
  memberships: { program: Program; status: Tables<"memberships">["status"]; grace_until: string | null }[];
  pastTickets: { id: string; number: number; subject: string; status: TicketStatus }[];
  staff: (StaffOption & { avatar_url: string | null })[];
  tasks: TaskRow[];
  today: string;
};

const UNASSIGNED = "unassigned";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-rule flex items-center justify-between border-b pb-2">
        <h2 className="note text-muted-foreground text-[15px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The staff workspace beside a ticket: controls, who the client is, and linked tasks. */
export function TicketPanel({ ticket, requester, memberships, pastTickets, staff, tasks, today }: TicketPanelData) {
  const { profile } = useHub();
  const [pending, startTransition] = useTransition();
  const [view, apply] = useOptimistic(
    { status: ticket.status, priority: ticket.priority, assignee_id: ticket.assignee_id },
    (state, patch: Partial<{ status: TicketStatus; priority: TicketPriority; assignee_id: string | null }>) => ({ ...state, ...patch }),
  );
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; task?: TaskRow }>({ open: false });

  const change = (patch: Partial<{ status: TicketStatus; priority: TicketPriority; assignee_id: string | null }>) =>
    startTransition(async () => {
      apply(patch);
      const res = await updateTicket(ticket.id, patch);
      if (!res.ok) toast.error(res.error);
    });

  const staffItems: Record<string, string> = {
    [UNASSIGNED]: "Unassigned",
    ...Object.fromEntries(staff.map((s) => [s.id, s.id === profile.id ? `${s.display_name} (you)` : s.display_name])),
  };

  return (
    <div className="flex flex-col gap-8 px-5 py-6" aria-busy={pending}>
      <Section title="Ticket">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-status">Status</Label>
          <Select
            value={view.status}
            onValueChange={(v) => change({ status: v as TicketStatus })}
            items={Object.fromEntries(STATUS_ORDER.map((s) => [s, STATUS_META[s].label]))}
          >
            <SelectTrigger id="ticket-status" className="h-11 w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusDot status={s} /> {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="ticket-assignee">Assignee</Label>
            {view.assignee_id !== profile.id && (
              <button
                type="button"
                onClick={() => change({ assignee_id: profile.id })}
                className="text-primary min-h-8 cursor-pointer text-[13px] font-semibold hover:underline"
              >
                Assign to me
              </button>
            )}
          </div>
          <Select
            value={view.assignee_id ?? UNASSIGNED}
            onValueChange={(v) => change({ assignee_id: v === UNASSIGNED ? null : (v as string) })}
            items={staffItems}
          >
            <SelectTrigger id="ticket-assignee" className="h-11 w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {staffItems[s.id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-priority">Priority</Label>
          <Select value={view.priority} onValueChange={(v) => change({ priority: v as TicketPriority })} items={PRIORITY_LABEL}>
            <SelectTrigger id="ticket-priority" className="h-11 w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_ORDER.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section
        title="Tasks"
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer gap-1 px-2 text-[13px] font-semibold"
            onClick={() => setTaskDialog({ open: true })}
          >
            <Plus className="size-3.5" aria-hidden /> Add task
          </Button>
        }
      >
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tasks yet. Add one for follow-ups that happen outside this thread.
          </p>
        ) : (
          <div className="-my-2 flex flex-col">
            {tasks.map((t) => (
              <TaskLine key={t.id} task={t} today={today} showTicket={false} onEdit={(task) => setTaskDialog({ open: true, task })} />
            ))}
          </div>
        )}
      </Section>

      {requester && (
        <Section title="Client">
          <div className="flex items-center gap-3">
            <UserAvatar name={requester.display_name} src={requester.avatar_url} seed={requester.id} className="size-10" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{requester.display_name}</p>
              <a href={`mailto:${requester.email}`} className="text-muted-foreground block truncate text-sm hover:underline">
                {requester.email}
              </a>
            </div>
          </div>
          {memberships.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {memberships.map((m) => (
                <li key={m.program} className="flex items-center gap-2 text-sm">
                  <span className="h-3.5 w-[3px] rounded-full" style={{ background: PROGRAMS[m.program].accent }} aria-hidden />
                  <span className="flex-1">{PROGRAMS[m.program].label}</span>
                  <span className={membershipGrantsAccess(m) ? "text-success font-semibold" : "text-muted-foreground font-semibold"}>
                    {membershipGrantsAccess(m) ? "Active" : m.status === "past_due" ? "Payment issue" : "Ended"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pastTickets.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-semibold">Other tickets</p>
              <ul className="flex flex-col">
                {pastTickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/dashboard/tickets/${t.number}`}
                      className="hover:bg-muted/60 -mx-2 flex min-h-9 items-center gap-2 rounded-md px-2 text-sm"
                    >
                      <StatusDot status={t.status} />
                      <span className="text-muted-foreground tabular-nums">#{t.number}</span>
                      <span className="truncate">{t.subject}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog((s) => ({ ...s, open }))}
        task={taskDialog.task}
        defaults={{ ticket_id: ticket.id, assignee_id: profile.id, priority: ticket.priority === "urgent" ? "urgent" : "normal" }}
        staff={staff}
        tickets={[{ id: ticket.id, number: ticket.number, subject: ticket.subject }]}
      />
    </div>
  );
}
