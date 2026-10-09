"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { UserAvatar } from "@/components/shell/user-avatar";
import { PriorityTag } from "@/components/tickets/ticket-tags";
import { updateTask } from "@/app/(hub)/dashboard/tasks/actions";
import type { TaskRow } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { DueLabel, TaskCheck } from "./task-bits";

/** A compact task row for side panels and the overview. Ticking it off saves right away. */
export function TaskLine({
  task,
  today,
  showTicket = true,
  onEdit,
}: {
  task: TaskRow;
  today: string;
  showTicket?: boolean;
  onEdit?: (task: TaskRow) => void;
}) {
  const [status, setStatus] = useOptimistic(task.status);
  const [, startTransition] = useTransition();
  const done = status === "done";

  const toggle = () =>
    startTransition(async () => {
      const next = done ? "todo" : "done";
      setStatus(next);
      const res = await updateTask(task.id, { status: next });
      if (!res.ok) toast.error(res.error);
    });

  return (
    <div className="flex min-h-12 items-start gap-3 py-2">
      <div className="pt-0.5">
        <TaskCheck done={done} title={task.title} onToggle={toggle} />
      </div>
      <div className="min-w-0 flex-1">
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(task)}
            className={cn(
              "cursor-pointer text-left text-[15px] leading-snug hover:underline",
              done && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </button>
        ) : (
          <span className={cn("text-[15px] leading-snug", done && "text-muted-foreground line-through")}>{task.title}</span>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DueLabel dueOn={task.due_on} today={today} done={done} />
          <PriorityTag priority={task.priority} />
          {showTicket && task.ticket && (
            <Link href={`/dashboard/tickets/${task.ticket.number}`} className="text-muted-foreground text-[12px] hover:underline">
              #{task.ticket.number}
            </Link>
          )}
        </div>
      </div>
      {task.assignee && (
        <UserAvatar name={task.assignee.display_name} src={task.assignee.avatar_url} seed={task.assignee.id} className="mt-0.5 size-6 text-[10px]" />
      )}
    </div>
  );
}
