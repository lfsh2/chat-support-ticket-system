"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

export type HubProfile = Pick<Tables<"profiles">, "id" | "email" | "display_name" | "avatar_url" | "role">;
export type HubChannel = Pick<Tables<"channels">, "id" | "slug" | "name" | "description" | "program" | "type" | "position">;
export type UnreadCounts = Record<string, number>;

type HubContextValue = {
  profile: HubProfile;
  isStaff: boolean;
  channels: HubChannel[];
  unread: UnreadCounts;
  setChannelRead: (channelId: string) => void;
};

const HubContext = createContext<HubContextValue | null>(null);

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used inside <HubProvider>");
  return ctx;
}

export const UNREAD_KEY = ["unread"] as const;

export function HubProvider({
  profile,
  channels,
  initialUnread,
  children,
}: {
  profile: HubProfile;
  channels: HubChannel[];
  initialUnread: UnreadCounts;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const { data: unread = initialUnread } = useQuery({
    queryKey: UNREAD_KEY,
    initialData: initialUnread,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("channel_unread_counts");
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.channel_id, r.unread])) as UnreadCounts;
    },
  });

  // Any new message in a channel we can see → refresh unread counts (debounced).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const sub = supabase
      .channel("hub:unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as Tables<"messages">;
        if (!row.channel_id || row.parent_id || row.author_id === profile.id) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => queryClient.invalidateQueries({ queryKey: UNREAD_KEY }), 400);
      })
      .subscribe((status) => {
        // Catch up on anything sent while we were (re)connecting.
        if (status === "SUBSCRIBED") void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
      });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(sub);
    };
  }, [supabase, queryClient, profile.id]);

  const value = useMemo<HubContextValue>(
    () => ({
      profile,
      isStaff: profile.role !== "member",
      channels,
      unread,
      setChannelRead: (channelId) =>
        queryClient.setQueryData<UnreadCounts>(UNREAD_KEY, (prev) => ({ ...prev, [channelId]: 0 })),
    }),
    [profile, channels, unread, queryClient],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}
