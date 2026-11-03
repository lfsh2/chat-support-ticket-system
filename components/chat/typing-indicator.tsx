"use client";

import { typingLabel, type Typer } from "@/hooks/use-typing";

/** One quiet line above the composer. Always takes its height, so the list doesn't jump. */
export function TypingIndicator({ typers }: { typers: Typer[] }) {
  const label = typingLabel(typers);
  return (
    <div className="text-muted-foreground h-5 shrink-0 truncate px-4 text-xs leading-5 md:px-6" aria-hidden={!label}>
      {label && (
        <span className="animate-in fade-in motion-reduce:animate-none inline-flex items-center gap-1.5 duration-200">
          <span className="inline-flex gap-0.5" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="bg-muted-foreground/70 size-1 animate-pulse rounded-full motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          {label}
        </span>
      )}
    </div>
  );
}
