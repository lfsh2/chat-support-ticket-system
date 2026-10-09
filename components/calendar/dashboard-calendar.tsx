"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHub } from "@/components/shell/hub-context";
import { TaskLine } from "@/components/tasks/task-line";
import { ProgramTag } from "@/components/tickets/ticket-tags";
import { EventDialog } from "./event-dialog";
import { WEEKDAYS, dayHeading, monthGrid, monthLabel, monthOf, shiftMonth, type CalendarEvent } from "@/lib/calendar";
import { PROGRAMS } from "@/lib/config";
import { dueState, type TaskRow } from "@/lib/tasks";
import { dayKey, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

function eventColor(e: CalendarEvent) {
  return e.program ? PROGRAMS[e.program].accent : "var(--ink)";
}

/**
 * Month view + agenda for the selected day. Members see events for their programs;
 * the team also sees task due dates and can add or edit events.
 * The month lives in the URL (?month=2026-11), so data comes from the server.
 */
export function DashboardCalendar({
  month,
  today,
  timeZone,
  events,
  tasks,
  upcoming,
}: {
  month: string;
  today: string;
  timeZone: string;
  events: CalendarEvent[];
  tasks: TaskRow[];
  upcoming: CalendarEvent[];
}) {
  const { isStaff } = useHub();
  const grid = useMemo(() => monthGrid(month), [month]);

  const defaultDay = monthOf(today) === month ? today : `${month}-01`;
  const [selected, setSelected] = useState(defaultDay);
  const [shownMonth, setShownMonth] = useState(month);
  if (shownMonth !== month) {
    setShownMonth(month);
    setSelected(defaultDay);
  }

  const [dialog, setDialog] = useState<{ open: boolean; event?: CalendarEvent }>({ open: false });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
      const key = dayKey(new Date(e.starts_at), timeZone);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events, timeZone]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const t of tasks) if (t.due_on) map.set(t.due_on, [...(map.get(t.due_on) ?? []), t]);
    return map;
  }, [tasks]);

  const dayEvents = eventsByDay.get(selected) ?? [];
  const dayTasks = tasksByDay.get(selected) ?? [];
  const comingUp = upcoming.filter((e) => dayKey(new Date(e.starts_at), timeZone) > selected).slice(0, 3);

  const monthHref = (m: string) => (m === monthOf(today) ? "/dashboard" : `/dashboard?month=${m}`);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* Month grid */}
      <div className="min-w-0">
        <div className="flex items-center gap-1 pb-3">
          <h4 className="font-display flex-1 text-[22px] leading-tight" aria-live="polite">
            {monthLabel(month)}
          </h4>
          {monthOf(today) !== month && (
            <Button
              variant="ghost"
              className="h-10 cursor-pointer px-3 text-[13px] font-semibold"
              nativeButton={false}
              render={<Link href={monthHref(monthOf(today))} scroll={false} />}
            >
              Today
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-10 cursor-pointer"
            nativeButton={false}
            render={<Link href={monthHref(shiftMonth(month, -1))} scroll={false} aria-label="Previous month" />}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 cursor-pointer"
            nativeButton={false}
            render={<Link href={monthHref(shiftMonth(month, 1))} scroll={false} aria-label="Next month" />}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div role="grid" aria-label={monthLabel(month)} className="border-rule border-t">
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} role="columnheader" className="text-muted-foreground py-2 text-center text-[11px] font-semibold tracking-wide uppercase">
                <span aria-hidden>{d.slice(0, 1)}</span>
                <span className="sr-only">{d}</span>
              </div>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, w) => (
            <div key={w} role="row" className="border-rule grid grid-cols-7 border-t">
              {grid.slice(w * 7, w * 7 + 7).map((day) => {
                const inMonth = monthOf(day) === month;
                const evs = eventsByDay.get(day) ?? [];
                const tks = tasksByDay.get(day) ?? [];
                const overdue = tks.some((t) => t.status !== "done" && dueState(t.due_on, today) === "overdue");
                const isToday = day === today;
                const isSelected = day === selected;
                const label = [
                  dayHeading(day),
                  evs.length ? `${evs.length} ${evs.length === 1 ? "event" : "events"}` : "",
                  tks.length ? `${tks.length} ${tks.length === 1 ? "task" : "tasks"} due` : "",
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <div key={day} role="gridcell" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => setSelected(day)}
                      aria-label={label}
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "flex h-12 w-full cursor-pointer flex-col items-center justify-start gap-1 rounded-md pt-1.5 transition-colors outline-none md:h-16",
                        "hover:bg-muted/70 focus-visible:ring-ring/50 focus-visible:ring-3",
                        isSelected && "bg-muted",
                        !inMonth && "text-muted-foreground/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums",
                          isToday && "bg-ink text-background font-bold",
                          isSelected && !isToday && "ring-foreground/60 font-semibold ring-[1.5px]",
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                      <span className="flex h-1.5 items-center gap-[3px]" aria-hidden>
                        {evs.slice(0, 3).map((e) => (
                          <span key={e.id} className="size-1.5 rounded-full" style={{ background: eventColor(e) }} />
                        ))}
                        {tks.length > 0 && (
                          <span
                            className={cn(
                              "size-1.5 rounded-full border",
                              overdue ? "border-destructive bg-destructive" : "border-foreground/60 bg-transparent",
                            )}
                          />
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="bg-ink size-1.5 rounded-full" aria-hidden /> Everyone
          </li>
          {(["coachos", "alive_free"] as const)
            .filter((p) => events.some((e) => e.program === p))
            .map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: PROGRAMS[p].accent }} aria-hidden />
                {PROGRAMS[p].label}
              </li>
            ))}
          {isStaff && (
            <li className="flex items-center gap-1.5">
              <span className="border-foreground/60 size-1.5 rounded-full border" aria-hidden /> Task due
            </li>
          )}
        </ul>
      </div>

      {/* Agenda for the selected day */}
      <div className="min-w-0 md:border-rule md:border-l md:pl-6 lg:pl-8">
        <div className="flex items-center gap-2 pb-2">
          <h4 className="note flex-1 text-[17px]">{selected === today ? "Today" : dayHeading(selected)}</h4>
          {isStaff && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 cursor-pointer gap-1 px-2 text-[13px] font-semibold"
              onClick={() => setDialog({ open: true })}
            >
              <Plus className="size-3.5" aria-hidden /> Add event
            </Button>
          )}
        </div>

        {dayEvents.length === 0 && dayTasks.length === 0 ? (
          <p className="text-muted-foreground py-2 text-[15px]">Nothing on this day.</p>
        ) : (
          <div className="flex flex-col">
            {dayEvents.map((e) => (
              <EventRow key={e.id} event={e} timeZone={timeZone} onEdit={isStaff ? () => setDialog({ open: true, event: e }) : undefined} />
            ))}
            {dayTasks.length > 0 && (
              <div className={cn(dayEvents.length > 0 && "border-rule mt-2 border-t pt-2")}>
                <p className="text-muted-foreground text-xs font-semibold">Tasks due</p>
                {dayTasks.map((t) => (
                  <TaskLine key={t.id} task={t} today={today} />
                ))}
              </div>
            )}
          </div>
        )}

        {comingUp.length > 0 && (
          <div className="border-rule mt-5 border-t pt-3">
            <p className="text-muted-foreground pb-1 text-xs font-semibold">Coming up</p>
            <ul className="flex flex-col">
              {comingUp.map((e) => {
                const start = new Date(e.starts_at);
                const key = dayKey(start, timeZone);
                return (
                  <li key={e.id}>
                    <Link
                      href={monthOf(key) === month ? "#" : monthHref(monthOf(key))}
                      scroll={false}
                      onClick={(ev) => {
                        if (monthOf(key) === month) {
                          ev.preventDefault();
                          setSelected(key);
                        }
                      }}
                      className="hover:bg-muted/60 -mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5"
                    >
                      <span className="h-6 w-[3px] shrink-0 rounded-full" style={{ background: eventColor(e) }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{e.title}</span>
                        <span className="text-muted-foreground block text-xs">
                          {dayHeading(key)} · {formatTime(start, timeZone)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {isStaff && (
        <EventDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          event={dialog.event}
          day={selected}
          timeZone={timeZone}
        />
      )}
    </div>
  );
}

function EventRow({ event, timeZone, onEdit }: { event: CalendarEvent; timeZone: string; onEdit?: () => void }) {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  return (
    <article className="border-rule flex gap-3 border-b py-3 last:border-0">
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: eventColor(event) }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-semibold tabular-nums">
          {formatTime(start, timeZone)}
          {end && ` – ${formatTime(end, timeZone)}`}
        </p>
        <h5 className="text-[15px] leading-snug font-semibold">{event.title}</h5>
        <div className="mt-0.5">
          {event.program ? <ProgramTag program={event.program} /> : <span className="text-muted-foreground text-[13px]">Everyone</span>}
        </div>
        {event.description && <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{event.description}</p>}
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground mt-1.5 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold underline-offset-4 hover:underline"
          >
            Join <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
      {onEdit && (
        <Button variant="ghost" size="icon" className="text-muted-foreground size-9 cursor-pointer" onClick={onEdit} aria-label={`Edit ${event.title}`}>
          <Pencil className="size-4" />
        </Button>
      )}
    </article>
  );
}
