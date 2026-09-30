"use client";

import { cn } from "@/lib/utils";
import type { Reaction } from "@/lib/chat/types";

export function ReactionBar({
  reactions,
  myId,
  onToggle,
}: {
  reactions: Reaction[];
  myId: string;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
    g.count++;
    g.mine ||= r.user_id === myId;
    grouped.set(r.emoji, g);
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {[...grouped].map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          aria-pressed={mine}
          aria-label={`${emoji} ${count} ${count === 1 ? "reaction" : "reactions"}${mine ? ", including you" : ""}`}
          className={cn(
            "animate-in zoom-in-90 flex h-8 min-w-11 items-center justify-center gap-1 rounded-full border px-2.5 text-sm tabular-nums transition-colors duration-150 motion-reduce:animate-none",
            mine ? "border-primary/40 bg-primary/10 text-primary" : "bg-muted/60 hover:bg-muted border-transparent",
          )}
        >
          <span aria-hidden>{emoji}</span>
          <span aria-hidden>{count}</span>
        </button>
      ))}
    </div>
  );
}
