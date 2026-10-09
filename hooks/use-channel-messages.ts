"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import {
  MAX_ATTACHMENT_BYTES,
  MESSAGE_SELECT,
  PAGE_SIZE,
  type Attachment,
  type Author,
  type ChatMessage,
} from "@/lib/chat/types";

type Pages = InfiniteData<ChatMessage[], string | null>;

/** Payloads for optimistic sends, kept so "Retry" can resend without re-picking files. */
const pending = new Map<string, { body: string; files: File[]; kind: SendKind; uploaded?: Attachment[] }>();

export function messagesKey(scopeId: string) {
  return ["messages", scopeId] as const;
}

/** Which stream a message list belongs to: a channel, or a ticket's private thread. */
export type MessageScope = { column: "channel_id" | "ticket_id"; id: string };
export type SendKind = "user" | "internal_note";

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file";
}

export function friendlyError(error: { message?: string; hint?: string } | null | undefined) {
  if (error?.hint === "rate_limited" && error.message) return error.message;
  return "Your message didn't send. Check your connection and tap Retry.";
}

export function useChannelMessages({ channelId, ...rest }: { channelId: string; me: Author; initialMessages: ChatMessage[] }) {
  return useMessages({ scope: { column: "channel_id", id: channelId }, ...rest });
}

export function useMessages({
  scope,
  me,
  initialMessages,
}: {
  scope: MessageScope;
  me: Author;
  initialMessages: ChatMessage[];
}) {
  const { column, id: scopeId } = scope;
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: messagesKey(scopeId),
    initialPageParam: null as string | null,
    initialData: { pages: [initialMessages], pageParams: [null] },
    staleTime: Infinity, // realtime keeps it fresh
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq(column, scopeId)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as ChatMessage[];
    },
    getNextPageParam: (last) => (last.length < PAGE_SIZE ? undefined : (last[last.length - 1]?.created_at ?? undefined)),
  });

  // --- cache helpers -------------------------------------------------------
  const patch = useCallback(
    (fn: (m: ChatMessage) => ChatMessage | null, id?: string) => {
      queryClient.setQueryData<Pages>(messagesKey(scopeId), (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) =>
                page.flatMap((m) => {
                  if (id && m.id !== id) return [m];
                  const next = fn(m);
                  return next ? [next] : [];
                }),
              ),
            }
          : data,
      );
    },
    [queryClient, scopeId],
  );

  const upsertNewest = useCallback(
    (msg: ChatMessage) => {
      queryClient.setQueryData<Pages>(messagesKey(scopeId), (data) => {
        if (!data) return data;
        const exists = data.pages.some((p) => p.some((m) => m.id === msg.id));
        if (exists) {
          return { ...data, pages: data.pages.map((p) => p.map((m) => (m.id === msg.id ? { ...msg, status: undefined } : m))) };
        }
        const [first = [], ...rest] = data.pages;
        return { ...data, pages: [[msg, ...first], ...rest] };
      });
    },
    [queryClient, scopeId],
  );

  const fetchOne = useCallback(
    async (id: string) => {
      const { data } = await supabase.from("messages").select(MESSAGE_SELECT).eq("id", id).maybeSingle();
      return data as unknown as ChatMessage | null;
    },
    [supabase],
  );

  // --- realtime -------------------------------------------------------------
  useEffect(() => {
    const sub = supabase
      .channel(`messages:${scopeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `${column}=eq.${scopeId}` },
        async (payload) => {
          const row = payload.new as Tables<"messages">;
          if (row.parent_id) return; // thread replies arrive in Phase 3's thread view
          const full = await fetchOne(row.id);
          if (full) upsertNewest(full);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `${column}=eq.${scopeId}` },
        (payload) => {
          const row = payload.new as Tables<"messages">;
          patch(
            (m) => ({
              ...m,
              body: row.body,
              edited_at: row.edited_at,
              deleted_at: row.deleted_at,
              reply_count: row.reply_count,
              attachments: row.attachments as Attachment[],
            }),
            row.id,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `${column}=eq.${scopeId}` },
        (payload) => patch(() => null, (payload.old as { id: string }).id),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, (payload) => {
        const r = payload.new as Tables<"reactions">;
        patch(
          (m) =>
            m.reactions.some((x) => x.emoji === r.emoji && x.user_id === r.user_id)
              ? m
              : { ...m, reactions: [...m.reactions, { emoji: r.emoji, user_id: r.user_id }] },
          r.message_id,
        );
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, (payload) => {
        const r = payload.old as Partial<Tables<"reactions">>;
        if (!r.message_id) return;
        patch(
          (m) => ({ ...m, reactions: m.reactions.filter((x) => !(x.emoji === r.emoji && x.user_id === r.user_id)) }),
          r.message_id,
        );
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Catch up on anything sent between the server render and this subscription
        // going live (and after any reconnect).
        void queryClient.refetchQueries({ queryKey: messagesKey(scopeId) });
      });
    return () => {
      supabase.removeChannel(sub);
    };
  }, [supabase, column, scopeId, fetchOne, patch, upsertNewest, queryClient]);

  // --- mutations ------------------------------------------------------------
  const deliver = useCallback(
    async (id: string) => {
      const job = pending.get(id);
      if (!job) return;
      patch((m) => ({ ...m, status: "sending" }), id);

      try {
        if (!job.uploaded) {
          job.uploaded = await Promise.all(
            job.files.map(async (file) => {
              const folder = column === "ticket_id" ? "tickets" : "channels";
              const path = `${folder}/${scopeId}/${me.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
              const { error } = await supabase.storage.from("attachments").upload(path, file, {
                contentType: file.type || "application/octet-stream",
              });
              if (error) throw error;
              return { path, name: file.name, size: file.size, type: file.type };
            }),
          );
        }

        const { data, error } = await supabase
          .from("messages")
          .insert({
            id,
            ...(column === "ticket_id" ? { ticket_id: scopeId } : { channel_id: scopeId }),
            author_id: me.id,
            kind: job.kind,
            body: job.body,
            attachments: job.uploaded,
          })
          .select(MESSAGE_SELECT)
          .single();
        if (error) throw error;

        pending.delete(id);
        upsertNewest(data as unknown as ChatMessage);
      } catch (err) {
        patch((m) => ({ ...m, status: "failed" }), id);
        toast.error(friendlyError(err as { message?: string; hint?: string }));
      }
    },
    [column, scopeId, me.id, patch, supabase, upsertNewest],
  );

  const send = useCallback(
    (body: string, files: File[] = [], kind: SendKind = "user") => {
      const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
      if (tooBig) {
        toast.error(`"${tooBig.name}" is over 10 MB. Try a smaller file or share a link instead.`);
        return false;
      }
      const id = crypto.randomUUID();
      pending.set(id, { body, files, kind });
      upsertNewest({
        id,
        channel_id: column === "channel_id" ? scopeId : null,
        ticket_id: column === "ticket_id" ? scopeId : null,
        parent_id: null,
        author_id: me.id,
        kind,
        body,
        attachments: files.map((f) => ({
          path: "",
          name: f.name,
          size: f.size,
          type: f.type,
          previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        })),
        via: "web",
        reply_count: 0,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        author: me,
        reactions: [],
        status: "sending",
      });
      void deliver(id);
      return true;
    },
    [column, scopeId, deliver, me, upsertNewest],
  );

  const edit = useCallback(
    async (id: string, body: string) => {
      const before = query.data?.pages.flat().find((m) => m.id === id);
      patch((m) => ({ ...m, body, edited_at: new Date().toISOString() }), id);
      const { error } = await supabase.from("messages").update({ body }).eq("id", id);
      if (error) {
        if (before) patch(() => before, id);
        toast.error("Your edit didn't save. Please try again.");
      }
    },
    [patch, query.data, supabase],
  );

  const remove = useCallback(
    async (id: string) => {
      if (pending.has(id)) {
        pending.delete(id);
        patch(() => null, id);
        return;
      }
      const before = query.data?.pages.flat().find((m) => m.id === id);
      patch((m) => ({ ...m, body: "", attachments: [], deleted_at: new Date().toISOString() }), id);
      const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        if (before) patch(() => before, id);
        toast.error("We couldn't delete that message. Please try again.");
      }
    },
    [patch, query.data, supabase],
  );

  const toggleReaction = useCallback(
    async (message: ChatMessage, emoji: string) => {
      const mine = message.reactions.some((r) => r.emoji === emoji && r.user_id === me.id);
      patch(
        (m) => ({
          ...m,
          reactions: mine
            ? m.reactions.filter((r) => !(r.emoji === emoji && r.user_id === me.id))
            : [...m.reactions, { emoji, user_id: me.id }],
        }),
        message.id,
      );
      const { error } = mine
        ? await supabase.from("reactions").delete().match({ message_id: message.id, user_id: me.id, emoji })
        : await supabase.from("reactions").insert({ message_id: message.id, user_id: me.id, emoji });
      if (error && error.code !== "23505") {
        patch((m) => ({ ...m, reactions: message.reactions }), message.id);
        toast.error("That reaction didn't save. Please try again.");
      }
    },
    [me.id, patch, supabase],
  );

  // Oldest first, for rendering.
  const messages = useMemo(() => (query.data?.pages.flat() ?? []).slice().reverse(), [query.data]);

  return {
    messages,
    hasOlder: query.hasNextPage,
    loadingOlder: query.isFetchingNextPage,
    loadOlder: query.fetchNextPage,
    send,
    retry: deliver,
    edit,
    remove,
    toggleReaction,
  };
}
