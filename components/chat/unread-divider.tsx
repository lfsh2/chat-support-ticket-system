import { format, isThisYear, isToday, isYesterday } from "date-fns";

/** "New" marker: a blue hairline with a small label hung on the right. */
export function UnreadDivider() {
  return (
    <div
      className="animate-in fade-in my-3 flex items-center gap-2 pr-4 pl-16 duration-500 md:pl-[4.5rem] motion-reduce:animate-none md:pr-6"
      role="separator"
      aria-label="New messages"
    >
      <span className="bg-primary h-px flex-1" />
      <span className="text-primary text-[11px] font-bold tracking-[0.08em] uppercase">New</span>
    </div>
  );
}

/** Day marker written like a margin note: italic serif, ruled line trailing off. */
export function DateDivider({ date }: { date: Date }) {
  const label = isToday(date)
    ? "Today"
    : isYesterday(date)
      ? "Yesterday"
      : format(date, isThisYear(date) ? "EEEE, MMMM d" : "MMMM d, yyyy");
  return (
    <div
      className="paper sticky top-0 z-[5] mt-5 mb-1 flex items-center gap-3 px-4 py-1 md:px-6"
      role="separator"
      aria-label={label}
    >
      <span className="note text-foreground/80 text-[15px]">{label}</span>
      <span className="bg-rule h-px flex-1" />
    </div>
  );
}
