import { formatTime } from "@/lib/time";
import type { ChatMessage } from "@/lib/chat/types";

/** Inline ticket history: "Jon picked up this ticket · 3:05 PM", set like a margin note. */
export function SystemEvent({ message, timeZone }: { message: ChatMessage; timeZone: string }) {
  const at = new Date(message.created_at ?? 0);
  return (
    <div id={`message-${message.id}`} className="my-2 flex items-center gap-3 px-4 md:px-6" role="note">
      <span className="flex w-9 shrink-0 justify-center" aria-hidden>
        <span className="bg-rule h-px w-5" />
      </span>
      <p className="note text-muted-foreground min-w-0 text-[14px] leading-snug">
        <span className="text-foreground/85 not-italic font-sans text-[13px] font-semibold">
          {message.author?.display_name ?? "The team"}
        </span>{" "}
        {message.body}
        <span aria-hidden> · </span>
        <time dateTime={message.created_at ?? undefined} className="font-sans text-xs not-italic tabular-nums">
          {formatTime(at, timeZone)}
        </time>
      </p>
    </div>
  );
}
