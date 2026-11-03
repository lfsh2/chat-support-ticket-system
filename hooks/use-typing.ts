"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { joinChannel } from "@/lib/supabase/realtime";

export type Typer = { id: string; name: string };
type Signal = Typer & { stop?: boolean };

const SEND_EVERY_MS = 2500; // while someone keeps typing
const FORGET_AFTER_MS = 5000; // no signal for this long → they stopped

/**
 * "Jon is typing…" over Supabase Realtime Broadcast. `topic` is a channel, ticket or thread
 * id (null turns it off). Call `typing()` on every keystroke (it's throttled) and `stopped()`
 * after sending.
 */
export function useTyping(topic: string | null, me: Typer) {
  const supabase = useMemo(() => createClient(), []);
  const [typers, setTypers] = useState<(Typer & { until: number })[]>([]);
  const channel = useRef<RealtimeChannel | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!topic) return;
    const leave = joinChannel(supabase, `typing:${topic}`, { config: { broadcast: { self: false } } }, (ch) => {
      ch.on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as Signal;
        if (!p?.id || p.id === me.id) return;
        setTypers((prev) => {
          const rest = prev.filter((t) => t.id !== p.id);
          return p.stop ? rest : [...rest, { id: p.id, name: String(p.name).slice(0, 80), until: Date.now() + FORGET_AFTER_MS }];
        });
      }).subscribe();
      channel.current = ch;
    });
    const sweep = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const next = prev.filter((t) => t.until > now);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => {
      clearInterval(sweep);
      channel.current = null;
      lastSent.current = 0;
      leave();
      setTypers([]);
    };
  }, [supabase, topic, me.id]);

  const send = useCallback(
    (stop: boolean) => {
      const ch = channel.current;
      if (!ch) return;
      void ch.send({ type: "broadcast", event: "typing", payload: { id: me.id, name: me.name, ...(stop ? { stop } : {}) } });
    },
    [me.id, me.name],
  );

  const typing = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < SEND_EVERY_MS) return;
    lastSent.current = now;
    send(false);
  }, [send]);

  const stopped = useCallback(() => {
    if (!lastSent.current) return;
    lastSent.current = 0;
    send(true);
  }, [send]);

  const names = useMemo(() => typers.map(({ id, name }) => ({ id, name })), [typers]);
  return { typers: names, typing, stopped };
}

/** "Jon is typing…" / "Jon and Sam are typing…" / "Several people are typing…" */
export function typingLabel(typers: Typer[]): string {
  const names = typers.map((t) => t.name.replace(/\s*\(.*?\)\s*/g, " ").trim() || "Someone");
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}
