"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hash, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/shell/top-bar";
import { useHub, type HubChannel } from "@/components/shell/hub-context";
import { useChannelMessages } from "@/hooks/use-channel-messages";
import { buildListItems } from "@/lib/chat/group";
import { LAST_CHANNEL_COOKIE } from "@/lib/chat/last-channel";
import { toPlainText } from "@/lib/markdown";
import type { ChatMessage } from "@/lib/chat/types";
import { PROGRAMS } from "@/lib/config";
import { Composer, ReadOnlyNotice } from "./composer";
import { MessageList, type MessageListHandle } from "./message-list";

type Channel = Pick<HubChannel, "id" | "slug" | "name" | "description" | "program" | "type">;

export function ChannelView({
  channel,
  initialMessages,
  lastReadAt,
}: {
  channel: Channel;
  initialMessages: ChatMessage[];
  lastReadAt: string | null;
}) {
  const { profile, isStaff, setChannelRead } = useHub();
  const supabase = useMemo(() => createClient(), []);
  const me = useMemo(
    () => ({ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url, role: profile.role }),
    [profile],
  );
  const chat = useChannelMessages({ channelId: channel.id, me, initialMessages });
  const list = useRef<MessageListHandle>(null);

  // The "New messages" divider stays where it was when you opened the channel.
  const [unreadAfter] = useState(() => (lastReadAt ? new Date(lastReadAt) : null));
  const items = useMemo(
    () => buildListItems(chat.messages, { unreadAfter, currentUserId: profile.id }),
    [chat.messages, unreadAfter, profile.id],
  );

  // Remember this channel for "/".
  useEffect(() => {
    document.cookie = `${LAST_CHANNEL_COOKIE}=${channel.slug}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [channel.slug]);

  // --- read tracking -------------------------------------------------------
  const [atBottom, setAtBottom] = useState(true);
  const newest = chat.messages[chat.messages.length - 1];
  const [seenNewestId, setSeenNewestId] = useState(newest?.id);
  const markRead = useCallback(() => {
    setChannelRead(channel.id);
    // Supabase builders are lazy — .then() is what actually sends the request.
    supabase
      .rpc("mark_channel_read", { cid: channel.id })
      .then(({ error }) => {
        if (error) console.error("mark_channel_read failed", error.message);
      });
  }, [channel.id, setChannelRead, supabase]);

  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    if (atBottom && visible()) markRead();
    const onVisible = () => {
      if (visible() && atBottom) markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [atBottom, newest?.id, markRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- track what the reader has seen
    if (atBottom) setSeenNewestId(newest?.id);
  }, [atBottom, newest?.id]);

  const newWhileAway = useMemo(() => {
    if (atBottom || !seenNewestId) return 0;
    const idx = chat.messages.findIndex((m) => m.id === seenNewestId);
    return idx < 0 ? 0 : chat.messages.slice(idx + 1).filter((m) => m.author_id !== profile.id).length;
  }, [atBottom, seenNewestId, chat.messages, profile.id]);

  // --- screen reader announcement for incoming messages ----------------------
  const [announcement, setAnnouncement] = useState("");
  const lastAnnounced = useRef(newest?.id);
  useEffect(() => {
    if (!newest || newest.id === lastAnnounced.current) return;
    lastAnnounced.current = newest.id;
    if (newest.author_id !== profile.id && !newest.deleted_at) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors realtime arrivals into a live region
      setAnnouncement(`${newest.author?.display_name ?? "Someone"}: ${toPlainText(newest.body) || "sent an attachment"}`);
    }
  }, [newest, profile.id]);

  const send = useCallback(
    (body: string, files: File[]) => {
      const ok = chat.send(body, files);
      if (ok) requestAnimationFrame(() => list.current?.scrollToBottom(false));
      return ok;
    },
    [chat],
  );

  const canPost = channel.type !== "announcement" || isStaff;
  const Icon = channel.type === "announcement" ? Megaphone : Hash;
  const program = channel.program ? PROGRAMS[channel.program] : null;

  return (
    <>
      <TopBar
        accent={program?.accent}
        title={
          <>
            <span className="text-muted-foreground font-sans text-[17px] font-medium" aria-hidden>
              {channel.type === "announcement" ? "" : "#"}
            </span>
            <span className="truncate">{channel.name}</span>
            {program && <span className="sr-only">, {program.label}</span>}
          </>
        }
        subtitle={channel.description}
      />

      <MessageList
        ref={list}
        items={items}
        myId={profile.id}
        iAmStaff={isStaff}
        hasOlder={Boolean(chat.hasOlder)}
        loadingOlder={chat.loadingOlder}
        loadOlder={() => void chat.loadOlder()}
        onAtBottomChange={setAtBottom}
        newWhileAway={newWhileAway}
        onReact={chat.toggleReaction}
        onEdit={chat.edit}
        onDelete={chat.remove}
        onRetry={chat.retry}
        intro={
          <div className="px-4 pt-10 pb-2 md:px-6 md:pt-14">
            <p className="note text-muted-foreground flex items-center gap-2 text-[15px]">
              <Icon className="size-4 not-italic" aria-hidden />
              {program ? `${program.label} members` : "Everyone in the hub"}
            </p>
            <h2 className="font-display mt-1 text-[34px] leading-[1.05] tracking-tight md:text-[44px]">
              The start of {channel.type === "announcement" ? "" : "#"}
              {channel.name}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-prose text-[15px] leading-relaxed">
              {channel.description ? `${channel.description}. ` : ""}
              {canPost
                ? "Say hello, ask a question, or share what you're working on."
                : "The team posts news and updates here. React to let us know you've seen them."}
            </p>
          </div>
        }
      />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {canPost ? (
        <Composer draftId={channel.id} placeholder={`Message #${channel.name}`} onSend={send} />
      ) : (
        <ReadOnlyNotice channelName={channel.name} />
      )}
    </>
  );
}
