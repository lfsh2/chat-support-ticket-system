"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

export type HubProfile = Pick<Tables<"profiles">, "id" | "email" | "display_name" | "avatar_url" | "role" | "timezone">;
export type HubChannel = Pick<
  Tables<"channels">,
  "id" | "slug" | "name" | "description" | "program" | "type" | "position" | "parent_id" | "client_id" | "staff_only"
>;
export type UnreadCounts = Record<string, number>;

type HubContextValue = {
  profile: HubProfile;
  isStaff: boolean;
  channels: HubChannel[];
  unread: UnreadCounts;
  /** Zero a channel's badge now; pass `saved` once the read is stored to re-check every count. */
  setChannelRead: (channelId: string, saved?: boolean) => void;
  /** Unread Inbox items (mentions, thread replies, ticket updates). */
  inboxUnread: number;
  /** Re-count the Inbox and reload its list (after marking things read). */
  refreshInbox: () => void;
};

const HubContext = createContext<HubContextValue | null>(null);

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used inside <HubProvider>");
  return ctx;
}

export const UNREAD_KEY = ["unread"] as const;
export const INBOX_UNREAD_KEY = ["inbox-unread"] as const;
export const INBOX_KEY = ["inbox"] as const;

export function HubProvider({
  profile,
  channels,
  initialUnread,
  initialInboxUnread,
  children,
}: {
  profile: HubProfile;
  channels: HubChannel[];
  initialUnread: UnreadCounts;
  initialInboxUnread: number;
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

  const { data: inboxUnread = initialInboxUnread } = useQuery({
    queryKey: INBOX_UNREAD_KEY,
    initialData: initialInboxUnread,
    queryFn: async () => {
      // Inner join: only count notifications whose message we can still open.
      const { count, error } = await supabase
        .from("notifications")
        .select("id, message:messages!notifications_message_id_fkey!inner(id)", { count: "exact", head: true })
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // New notifications (and ones marked read in another tab) → refresh the badge and the list.
  const inboxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const refresh = () => {
      if (inboxTimer.current) clearTimeout(inboxTimer.current);
      inboxTimer.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: INBOX_UNREAD_KEY });
        void queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      }, 300);
    };
    const filter = `user_id=eq.${profile.id}`;
    const sub = supabase
      .channel(`hub:inbox:${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      if (inboxTimer.current) clearTimeout(inboxTimer.current);
      supabase.removeChannel(sub);
    };
  }, [supabase, queryClient, profile.id]);

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
      setChannelRead: (channelId, saved = false) => {
        queryClient.setQueryData<UnreadCounts>(UNREAD_KEY, (prev) => ({ ...prev, [channelId]: 0 }));
        // A count fetched while the read was in flight could bring the badge back; re-check.
        if (saved) void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
      },
      inboxUnread,
      refreshInbox: () => {
        void queryClient.invalidateQueries({ queryKey: INBOX_UNREAD_KEY });
        void queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      },
    }),
    [profile, channels, unread, inboxUnread, queryClient],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}
