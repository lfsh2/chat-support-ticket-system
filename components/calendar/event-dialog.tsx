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
import { createEvent, deleteEvent, updateEvent, type EventInput } from "@/app/(hub)/dashboard/events/actions";
import type { CalendarEvent } from "@/lib/calendar";
import { PROGRAMS } from "@/lib/config";
import { dayKey, timeKey } from "@/lib/time";

const EVERYONE = "everyone";

function toForm(event: CalendarEvent | undefined, day: string, timeZone: string): EventInput {
  if (!event) return { title: "", description: "", program: null, day, start: "12:00", end: "13:00", link: "" };
  const start = new Date(event.starts_at);
  return {
    title: event.title,
    description: event.description ?? "",
    program: event.program,
    day: dayKey(start, timeZone),
    start: timeKey(start, timeZone),
    end: event.ends_at ? timeKey(new Date(event.ends_at), timeZone) : "",
    link: event.link ?? "",
  };
}

/** Add or edit a calendar event (staff). Times are in the editor's own timezone. */
export function EventDialog({
  open,
  onOpenChange,
  event,
  day,
  timeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent;
  day: string;
  timeZone: string;
}) {
  const [form, setForm] = useState<EventInput>(() => toForm(event, day, timeZone));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reset each time it opens (not on every re-render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(toForm(event, day, timeZone));
      setError(null);
    }
  }

  const set = (patch: Partial<EventInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = event ? await updateEvent(event.id, form) : await createEvent(form);
      if (!res.ok) return setError(res.error);
      toast.success(event ? "Event updated." : "Event added to the calendar.");
      onOpenChange(false);
    });
  };

  const remove = () => {
    if (!event) return;
    startTransition(async () => {
      const res = await deleteEvent(event.id);
      if (!res.ok) return void toast.error(res.error);
      setConfirmDelete(false);
      onOpenChange(false);
      toast.success("Event deleted.");
    });
  };

  const zoneLabel = timeZone.replace(/_/g, " ").split("/").pop();

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => !pending && onOpenChange(next)}
        title={event ? "Edit event" : "New event"}
        description="Members see events for everyone, or for the program you pick."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-title">Name</Label>
            <Input
              id="event-title"
              autoFocus
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Live Q&A"
              className="h-11 text-base md:text-[15px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-program">Who it&apos;s for</Label>
            <Select
              value={form.program ?? EVERYONE}
              onValueChange={(v) => set({ program: v === EVERYONE ? null : (v as EventInput["program"]) })}
              items={{ [EVERYONE]: "Everyone", coachos: PROGRAMS.coachos.label, alive_free: PROGRAMS.alive_free.label }}
            >
              <SelectTrigger id="event-program" className="h-11 w-full text-base md:text-[15px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYONE}>Everyone</SelectItem>
                <SelectItem value="coachos">{PROGRAMS.coachos.label} members</SelectItem>
                <SelectItem value="alive_free">{PROGRAMS.alive_free.label} members</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor="event-day">Date</Label>
              <Input
                id="event-day"
                type="date"
                required
                value={form.day}
                onChange={(e) => set({ day: e.target.value })}
                className="h-11 text-base md:text-[15px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type="time"
                required
                value={form.start}
                onChange={(e) => set({ start: e.target.value })}
                className="h-11 text-base md:text-[15px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-end">Ends</Label>
              <Input
                id="event-end"
                type="time"
                value={form.end ?? ""}
                onChange={(e) => set({ end: e.target.value })}
                className="h-11 text-base md:text-[15px]"
              />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">Times are in your timezone ({zoneLabel}). Members see them in theirs.</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-link">Meeting link</Label>
            <Input
              id="event-link"
              type="url"
              inputMode="url"
              value={form.link ?? ""}
              onChange={(e) => set({ link: e.target.value })}
              placeholder="https://zoom.us/j/…"
              className="h-11 text-base md:text-[15px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-description">Details</Label>
            <Textarea
              id="event-description"
              value={form.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="What to expect, what to bring."
              className="min-h-20 text-base md:text-[15px]"
            />
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {event && (
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
              {pending ? "Saving…" : event ? "Save" : "Add event"}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{event?.title}&rdquo; will disappear from everyone&apos;s calendar. This can&apos;t be undone.
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
