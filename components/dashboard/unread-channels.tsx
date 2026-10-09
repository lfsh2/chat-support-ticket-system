"use client";

import Link from "next/link";
import { Hash, Megaphone } from "lucide-react";
import { useHub } from "@/components/shell/hub-context";
import { formatCount } from "@/components/shell/channel-nav";
import { PROGRAMS } from "@/lib/config";

/** Channels with unread messages, busiest first. Live: counts come from the hub's realtime cache. */
export function UnreadChannels({ limit = 5 }: { limit?: number }) {
  const { channels, unread } = useHub();
  const busy = channels
    .filter((c) => (unread[c.id] ?? 0) > 0)
    .sort((a, b) => (unread[b.id] ?? 0) - (unread[a.id] ?? 0))
    .slice(0, limit);

  if (busy.length === 0) {
    return (
      <p className="text-muted-foreground py-2 text-[15px]">
        You&apos;re all caught up.{" "}
        <Link href="/c/general" className="text-foreground font-semibold underline-offset-4 hover:underline">
          Say hi in #general
        </Link>
      </p>
    );
  }

  return (
    <ul>
      {busy.map((c) => {
        const Icon = c.type === "announcement" ? Megaphone : Hash;
        return (
          <li key={c.id} className="border-rule border-b last:border-0">
            <Link href={`/c/${c.slug}`} className="hover:bg-muted/60 -mx-2 flex min-h-12 items-center gap-3 rounded-md px-2">
              {c.program ? (
                <span className="h-4 w-[3px] shrink-0 rounded-full" style={{ background: PROGRAMS[c.program].accent }} aria-hidden />
              ) : (
                <span className="w-[3px] shrink-0" aria-hidden />
              )}
              <Icon className="text-muted-foreground size-4" aria-hidden />
              <span className="flex-1 truncate text-[15px] font-semibold">{c.name}</span>
              <span className="bg-ink text-background rounded-[4px] px-1.5 text-[11px] leading-[18px] font-bold tabular-nums">
                {formatCount(unread[c.id] ?? 0)}
                <span className="sr-only"> unread</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
