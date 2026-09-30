import { format, isToday, isYesterday } from "date-fns";

export function UnreadDivider() {
  return (
    <div
      className="animate-in fade-in text-destructive my-2 flex items-center gap-3 px-4 text-xs font-semibold duration-500 motion-reduce:animate-none md:px-5"
      role="separator"
      aria-label="New messages"
    >
      <span className="bg-destructive/50 h-px flex-1" />
      New messages
      <span className="bg-destructive/50 h-px w-6" />
    </div>
  );
}

export function DateDivider({ date }: { date: Date }) {
  const label = isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "EEEE, MMMM d");
  return (
    <div className="sticky top-0 z-[5] my-2 flex justify-center px-4" role="separator" aria-label={label}>
      <span className="bg-background/95 text-muted-foreground rounded-full border px-3 py-0.5 text-xs font-medium">
        {label}
      </span>
    </div>
  );
}
