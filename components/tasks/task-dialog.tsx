"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResponsiveDialog } from "@/components/shell/responsive-dialog";
import { createTask, deleteTask, updateTask, type TaskInput } from "@/app/(hub)/dashboard/tasks/actions";
import { TASK_COLUMNS, type TaskRow } from "@/lib/tasks";
import { PRIORITY_LABEL, PRIORITY_ORDER } from "@/lib/tickets";

export type StaffOption = { id: string; display_name: string };
export type TicketOption = { id: string; number: number; subject: string };

const NONE = "none";

function fromTask(task: Partial<TaskRow> | undefined): TaskInput {
  return {
    title: task?.title ?? "",
    notes: task?.notes ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "normal",
    assignee_id: task?.assignee_id ?? null,
    ticket_id: task?.ticket_id ?? null,
    due_on: task?.due_on ?? null,
  };
}

/** Add or edit a team task. Pass `task` to edit; `defaults` to prefill a new one (e.g. from a ticket). */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaults,
  staff,
  tickets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskRow;
  defaults?: Partial<TaskRow>;
  staff: StaffOption[];
  tickets: TicketOption[];
}) {
  const [form, setForm] = useState<TaskInput>(() => fromTask(task ?? defaults));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reset the form each time it opens (not on every re-render — realtime refreshes
  // would otherwise wipe what's being typed).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(fromTask(task ?? defaults));
      setError(null);
    }
  }

  const set = (patch: Partial<TaskInput>) => setForm((f) => ({ ...f, ...patch }));

  // Keep a linked ticket selectable even if it's no longer in the open list.
  const ticketOptions =
    task?.ticket && !tickets.some((t) => t.id === task.ticket!.id) ? [task.ticket, ...tickets] : tickets;

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = task ? await updateTask(task.id, form) : await createTask(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(task ? "Task updated." : "Task added.");
      onOpenChange(false);
    });
  };

  const remove = () => {
    if (!task) return;
    startTransition(async () => {
      const res = await deleteTask(task.id);
      if (!res.ok) return void toast.error(res.error);
      setConfirmDelete(false);
      onOpenChange(false);
      toast.success("Task deleted.");
    });
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => !pending && onOpenChange(next)}
        title={task ? "Edit task" : "New task"}
        description="Only the team can see tasks."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">What needs doing?</Label>
            <Input
              id="task-title"
              autoFocus
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Send Casey the DNS walkthrough"
              className="h-11 text-base md:text-[15px]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                value={form.assignee_id ?? NONE}
                onValueChange={(v) => set({ assignee_id: v === NONE ? null : (v as string) })}
                items={{ [NONE]: "Unassigned", ...Object.fromEntries(staff.map((s) => [s.id, s.display_name])) }}
              >
                <SelectTrigger id="task-assignee" className="h-11 w-full text-base md:text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input
                id="task-due"
                type="date"
                value={form.due_on ?? ""}
                onChange={(e) => set({ due_on: e.target.value || null })}
                className="h-11 text-base md:text-[15px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => set({ priority: v as TaskInput["priority"] })}
                items={PRIORITY_LABEL}
              >
                <SelectTrigger id="task-priority" className="h-11 w-full text-base md:text-[15px]">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set({ status: v as TaskInput["status"] })}
                items={Object.fromEntries(TASK_COLUMNS.map((c) => [c.status, c.label]))}
              >
                <SelectTrigger id="task-status" className="h-11 w-full text-base md:text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_COLUMNS.map((c) => (
                    <SelectItem key={c.status} value={c.status}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-ticket">Linked ticket</Label>
            <Select
              value={form.ticket_id ?? NONE}
              onValueChange={(v) => set({ ticket_id: v === NONE ? null : (v as string) })}
              items={{
                [NONE]: "None",
                ...Object.fromEntries(ticketOptions.map((t) => [t.id, `#${t.number} · ${t.subject}`])),
              }}
            >
              <SelectTrigger id="task-ticket" className="h-11 w-full max-w-full text-base md:text-[15px]">
                <SelectValue className="truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {ticketOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="truncate">
                      #{t.number} · {t.subject}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={form.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Anything a teammate would need to pick this up."
              className="min-h-24 text-base md:text-[15px]"
            />
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {task && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive h-11 cursor-pointer px-3"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="ghost" className="h-11 cursor-pointer px-4" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !form.title.trim()}
              className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold"
            >
              {pending ? "Saving…" : task ? "Save" : "Add task"}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{task?.title}&rdquo; will be removed for the whole team. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="h-11" onClick={remove} disabled={pending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
