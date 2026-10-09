import { PROGRAMS } from "@/lib/config";
import { PRIORITY_LABEL, STATUS_META, type TicketPriority, type TicketStatus } from "@/lib/tickets";
import type { Program } from "@/lib/access";
import { cn } from "@/lib/utils";

/** Status as a dot + word. Clients get plain words ("Waiting on you"), staff get queue words. */
export function StatusBadge({
  status,
  audience = "staff",
  className,
}: {
  status: TicketStatus;
  audience?: "staff" | "member";
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap", meta.text, className)}>
      <StatusDot status={status} />
      {audience === "member" ? meta.memberLabel : meta.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: TicketStatus; className?: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", STATUS_META[status].dot, className)} aria-hidden />;
}

/** Only shown when it matters: normal priority is the quiet default. */
export function PriorityTag({ priority, className }: { priority: TicketPriority; className?: string }) {
  if (priority === "normal") return null;
  return (
    <span
      className={cn(
        "rounded-[4px] px-1.5 text-[11px] leading-[18px] font-bold tracking-[0.04em] whitespace-nowrap uppercase",
        priority === "urgent" ? "bg-destructive text-white" : "border-foreground/60 text-foreground border",
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/** Program marker: brown for Alive & Free, blue for CoachOS (programs only, per the design rules). */
export function ProgramTag({ program, className }: { program: Program; className?: string }) {
  return (
    <span className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap", className)}>
      <span className="h-3 w-[3px] shrink-0 rounded-full" style={{ background: PROGRAMS[program].accent }} aria-hidden />
      {PROGRAMS[program].label}
    </span>
  );
}
