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
    <div className="mt-2 flex flex-wrap gap-1.5">
      {[...grouped].map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          aria-pressed={mine}
          aria-label={`${emoji} ${count} ${count === 1 ? "reaction" : "reactions"}${mine ? ", including you" : ""}`}
          className={cn(
            // 30px chip, 44px hit area via the pseudo-element.
            "animate-in zoom-in-90 relative flex h-[30px] min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-[13px] font-semibold tabular-nums transition-colors duration-150 before:absolute before:-inset-y-[7px] before:inset-x-0 motion-reduce:animate-none",
            mine
              ? "border-primary/50 bg-primary/[0.07] text-primary"
              : "border-rule bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
          )}
        >
          <span aria-hidden className="text-[15px] leading-none">{emoji}</span>
          <span aria-hidden>{count}</span>
        </button>
      ))}
    </div>
  );
}
