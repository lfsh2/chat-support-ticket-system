"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserAvatar } from "@/components/shell/user-avatar";
import { PriorityTag } from "@/components/tickets/ticket-tags";
import { updateTask } from "@/app/(hub)/dashboard/tasks/actions";
import { createClient } from "@/lib/supabase/client";
import { TASK_COLUMNS, dueState, sortColumn, type TaskRow, type TaskStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { DueLabel, TaskCheck } from "./task-bits";
import { TaskDialog, type StaffOption, type TicketOption } from "./task-dialog";

type Filter = "everyone" | "mine" | "unassigned";
const FILTER_KEY = "hub:tasks-filter";
const DONE_PREVIEW = 5;

/**
 * The team's task board. Desktop: three columns you can drag between. Phones: the same
 * columns stacked as sections. Every card also has a "Move to…" menu, so moving a task
 * never depends on dragging.
 */
export function TaskBoard({
  tasks,
  staff,
  tickets,
  meId,
  today,
}: {
  tasks: TaskRow[];
  staff: (StaffOption & { avatar_url: string | null })[];
  tickets: TicketOption[];
  meId: string;
  today: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [board, move] = useOptimistic(tasks, (state, { id, status }: { id: string; status: TaskStatus }) =>
    state.map((t) => (t.id === id ? { ...t, status, completed_at: status === "done" ? new Date().toISOString() : null } : t)),
  );

  const [filter, setFilter] = useState<Filter>("everyone");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY) as Filter | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- per-viewer preference from storage
      if (saved === "mine" || saved === "unassigned") setFilter(saved);
    } catch {
      // storage unavailable — default view
    }
  }, []);
  const pickFilter = (f: Filter) => {
    setFilter(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {
      // ignore
    }
  };

  const [dialog, setDialog] = useState<{ open: boolean; task?: TaskRow; status?: TaskStatus }>({ open: false });
  const [showAllDone, setShowAllDone] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  // Teammates' changes show up without a reload.
  const supabase = useMemo(() => createClient(), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const sub = supabase
      .channel("tasks:board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 300);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(sub);
    };
  }, [supabase, router]);

  const setStatus = (task: TaskRow, status: TaskStatus) => {
    if (task.status === status) return;
    startTransition(async () => {
      move({ id: task.id, status });
      const res = await updateTask(task.id, { status });
      if (!res.ok) toast.error(res.error);
    });
  };

  const visible = board.filter((t) =>
    filter === "mine" ? t.assignee_id === meId : filter === "unassigned" ? t.assignee_id === null : true,
  );
  const overdue = visible.filter((t) => t.status !== "done" && dueState(t.due_on, today) === "overdue").length;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={[filter]}
          onValueChange={(v) => v[0] && pickFilter(v[0] as Filter)}
          spacing={0}
          variant="outline"
          aria-label="Show tasks for"
        >
          {(
            [
              ["everyone", "Everyone"],
              ["mine", "Mine"],
              ["unassigned", "Unassigned"],
            ] as const
          ).map(([value, label]) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="data-pressed:bg-ink data-pressed:text-background h-10 cursor-pointer px-3.5 text-[13px] font-semibold"
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {overdue > 0 && (
          <p className="text-destructive text-sm font-semibold" role="status">
            {overdue} overdue
          </p>
        )}
        <div className="flex-1" />
        <Button
          onClick={() => setDialog({ open: true, status: "todo" })}
          className="bg-ink text-background hover:bg-ink/90 h-10 cursor-pointer gap-1.5 px-4 font-semibold"
        >
          <Plus className="size-4" aria-hidden /> New task
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
        {TASK_COLUMNS.map((col) => {
          let list = sortColumn(
            visible.filter((t) => t.status === col.status),
            col.status,
          );
          const hiddenDone = col.status === "done" && !showAllDone ? Math.max(0, list.length - DONE_PREVIEW) : 0;
          if (hiddenDone) list = list.slice(0, DONE_PREVIEW);
          const count = visible.filter((t) => t.status === col.status).length;

          return (
            <section
              key={col.status}
              aria-labelledby={`col-${col.status}`}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTarget !== col.status) setDropTarget(col.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const task = board.find((t) => t.id === e.dataTransfer.getData("text/task-id"));
                if (task) setStatus(task, col.status);
                setDropTarget(null);
                setDragging(null);
              }}
              className={cn(
                "flex min-w-0 flex-col rounded-xl transition-colors duration-150 md:min-h-64 md:p-2",
                "md:bg-[color-mix(in_oklab,var(--foreground)_2.5%,transparent)]",
                dropTarget === col.status && "md:bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)] md:ring-foreground/20 md:ring-2",
              )}
            >
              <header className="border-rule flex min-h-11 items-center gap-2 border-b px-1 pb-2 md:border-0 md:pb-0">
                <h2 id={`col-${col.status}`} className="font-display text-[20px] leading-tight">
                  {col.label}
                </h2>
                <span className="text-muted-foreground text-sm tabular-nums">{count}</span>
                {col.status !== "done" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground ml-auto size-9 cursor-pointer"
                    onClick={() => setDialog({ open: true, status: col.status })}
                    aria-label={`Add a task to ${col.label}`}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </header>

              {list.length === 0 ? (
                <p className="text-muted-foreground px-1 py-4 text-sm">{col.empty}</p>
              ) : (
                <ul className="flex flex-col gap-2 pt-2">
                  {list.map((task) => (
                    <li key={task.id}>
                      <TaskCard
                        task={task}
                        today={today}
                        dragging={dragging === task.id}
                        onDragStart={() => setDragging(task.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        onOpen={() => setDialog({ open: true, task })}
                        onMove={(status) => setStatus(task, status)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {hiddenDone > 0 && (
                <Button variant="ghost" className="text-muted-foreground mt-1 h-10 cursor-pointer text-sm" onClick={() => setShowAllDone(true)}>
                  Show {hiddenDone} more
                </Button>
              )}
            </section>
          );
        })}
      </div>

      <TaskDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        task={dialog.task}
        defaults={{ status: dialog.status ?? "todo", assignee_id: filter === "unassigned" ? null : meId }}
        staff={staff}
        tickets={tickets}
      />
    </div>
  );
}

function TaskCard({
  task,
  today,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
}: {
  task: TaskRow;
  today: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  const done = task.status === "done";
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-card border-rule group/card relative flex gap-3 rounded-xl border px-3 py-2.5 transition-[opacity,border-color] duration-150 md:cursor-grab md:active:cursor-grabbing",
        "hover:border-foreground/25",
        dragging && "opacity-40",
      )}
    >
      {/* Above the card-wide click target from the title button. */}
      <div className="relative z-10 pt-0.5">
        <TaskCheck done={done} title={task.title} onToggle={() => onMove(done ? "todo" : "done")} />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "w-full cursor-pointer text-left text-[15px] leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-ring/50 focus-visible:after:ring-3",
            done && "text-muted-foreground font-normal line-through",
          )}
        >
          {task.title}
        </button>
        {task.notes && !done && <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[13px]">{task.notes}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DueLabel dueOn={task.due_on} today={today} done={done} />
          <PriorityTag priority={task.priority} />
          {task.ticket && (
            <Link
              href={`/dashboard/tickets/${task.ticket.number}`}
              className="text-muted-foreground relative z-10 text-[12px] hover:underline"
              title={task.ticket.subject}
            >
              #{task.ticket.number}
            </Link>
          )}
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 flex-col items-end justify-between gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground -mt-1 -mr-1 size-9 cursor-pointer md:opacity-0 md:group-hover/card:opacity-100 md:focus-visible:opacity-100 md:data-popup-open:opacity-100"
                aria-label={`Actions for "${task.title}"`}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {TASK_COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                <DropdownMenuItem key={c.status} onClick={() => onMove(c.status)}>
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpen}>Edit…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {task.assignee ? (
          <UserAvatar
            name={task.assignee.display_name}
            src={task.assignee.avatar_url}
            seed={task.assignee.id}
            className="size-6 text-[10px]"
          />
        ) : (
          <span className="text-muted-foreground text-[11px] italic">Unassigned</span>
        )}
      </div>
    </article>
  );
}
