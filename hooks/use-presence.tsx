"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { joinChannel } from "@/lib/supabase/realtime";

/** Ids of people with the hub open right now (Supabase Realtime Presence). */
const PresenceContext = createContext<ReadonlySet<string>>(new Set());

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function PresenceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [online, setOnline] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    return joinChannel(supabase, "hub:presence", { config: { presence: { key: userId } } }, (channel) => {
      channel
        .on("presence", { event: "sync" }, () => {
          const next = new Set(Object.keys(channel.presenceState()));
          setOnline((prev) => (sameSet(prev, next) ? prev : next));
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void channel.track({ since: new Date().toISOString() });
        });
    });
  }, [supabase, userId]);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}

export function useIsOnline(userId: string | null | undefined) {
  const online = useContext(PresenceContext);
  return Boolean(userId && online.has(userId));
}
