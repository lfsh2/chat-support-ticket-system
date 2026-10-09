"use client";

import { Check } from "lucide-react";
import { dueState, formatDue } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Round checkbox with a 44px tap target around a 20px mark. */
export function TaskCheck({
  done,
  title,
  onToggle,
  disabled,
}: {
  done: boolean;
  title: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={done}
      aria-label={done ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
      className="group/check -m-3 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none disabled:cursor-default"
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150",
          "group-focus-visible/check:ring-ring/50 group-focus-visible/check:ring-3",
          done
            ? "bg-success border-success text-white"
            : "border-foreground/35 group-hover/check:border-foreground/70 text-transparent group-hover/check:text-foreground/40",
        )}
      >
        <Check className="size-3" strokeWidth={3} aria-hidden />
      </span>
    </button>
  );
}

/** "Today", "Overdue · Mon, Oct 6"… Overdue is the only loud state. */
export function DueLabel({ dueOn, today, done, className }: { dueOn: string | null; today: string; done?: boolean; className?: string }) {
  if (!dueOn) return null;
  const state = done ? "later" : dueState(dueOn, today);
  const label = formatDue(dueOn, today);
  return (
    <span
      className={cn(
        "text-[12px] whitespace-nowrap tabular-nums",
        state === "overdue" ? "text-destructive font-semibold" : state === "today" ? "text-foreground font-semibold" : "text-muted-foreground",
        className,
      )}
    >
      {state === "overdue" ? `Overdue · ${label}` : `Due ${label === "Today" || label === "Tomorrow" || label === "Yesterday" ? label.toLowerCase() : label}`}
    </span>
  );
}
