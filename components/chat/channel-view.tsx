"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Hash, Inbox, Lock, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/shell/top-bar";
import { useHub, type HubChannel } from "@/components/shell/hub-context";
import { useChannelMessages } from "@/hooks/use-channel-messages";
import { useTyping } from "@/hooks/use-typing";
import { buildListItems } from "@/lib/chat/group";
import { LAST_CHANNEL_COOKIE } from "@/lib/chat/last-channel";
import { toPlainText } from "@/lib/markdown";
import { safeTimeZone } from "@/lib/time";
import type { ChatMessage } from "@/lib/chat/types";
import { PROGRAMS } from "@/lib/config";
import { Composer, ReadOnlyNotice } from "./composer";
import { ChannelMenu } from "./channel-menu";
import { ClientChannelMenu } from "./client-channel-menu";
import { MailboxStatus } from "./mailbox-status";
import { TicketFromMessageDialog } from "@/components/tickets/ticket-from-message-dialog";
import { MessageList, type MessageListHandle } from "./message-list";
import { ThreadPanel } from "./thread-panel";
import { TypingIndicator } from "./typing-indicator";

const THREAD_PATH = /^\/c\/[^/]+\/t\/([0-9a-f-]{36})\/?$/;

type Channel = Pick<HubChannel, "id" | "slug" | "name" | "description" | "program" | "type" | "parent_id" | "client_id" | "staff_only">;

export function ChannelView({
  channel,
  initialMessages,
  lastReadAt,
  highlightId = null,
}: {
  channel: Channel;
  initialMessages: ChatMessage[];
  lastReadAt: string | null;
  /** A message to scroll to and flash: in the channel, or (with a thread open) a reply in it. */
  highlightId?: string | null;
}) {
  const { profile, isStaff, setChannelRead, inboxUnread, refreshInbox } = useHub();
  const timeZone = safeTimeZone(profile.timezone);
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
    () => buildListItems(chat.messages, { unreadAfter, currentUserId: profile.id, timeZone }),
    [chat.messages, unreadAfter, profile.id, timeZone],
  );

  // --- threads ----------------------------------------------------------------
  // The open thread lives in the URL (/c/<slug>/t/<id>), so it can be shared and survives
  // reloads. Opening and closing use history.pushState: instant, and Back closes it.
  const pathname = usePathname();
  const threadId = THREAD_PATH.exec(pathname)?.[1] ?? null;
  const openThread = useCallback(
    (m: ChatMessage) => window.history.pushState(null, "", `/c/${channel.slug}/t/${m.id}`),
    [channel.slug],
  );
  const closeThread = useCallback(() => window.history.pushState(null, "", `/c/${channel.slug}`), [channel.slug]);
  const threadParent = useMemo(
    () => (threadId ? (chat.messages.find((m) => m.id === threadId) ?? null) : null),
    [threadId, chat.messages],
  );
  // From the Inbox: a reply highlights inside the thread; the channel brings its parent into view.
  const [initialThread] = useState(threadId);
  const channelHighlight = initialThread ?? highlightId;
  const threadHighlight = initialThread && threadId === initialThread ? highlightId : null;

  const typingMe = useMemo(() => ({ id: profile.id, name: profile.display_name }), [profile.id, profile.display_name]);
  const typing = useTyping(`channel:${channel.id}`, typingMe);

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
        if (error) return console.error("mark_channel_read failed", error.message);
        setChannelRead(channel.id, true);
        // Reading the channel also clears mentions of you in it.
        if (inboxUnread > 0) refreshInbox();
      });
  }, [channel.id, setChannelRead, supabase, inboxUnread, refreshInbox]);

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

  // Team: a client's message (or anything in a client's private channel) can become a ticket.
  const [ticketFrom, setTicketFrom] = useState<ChatMessage | null>(null);
  const canCreateTicket = useCallback(
    (m: ChatMessage) => m.kind === "user" && (channel.client_id !== null || m.author?.role === "member"),
    [channel.client_id],
  );

  const canPost = channel.type !== "announcement" || isStaff;
  const isClientChannel = channel.client_id !== null;
  const Icon = isClientChannel ? Lock : channel.staff_only ? Inbox : channel.type === "announcement" ? Megaphone : Hash;
  const program = channel.program ? PROGRAMS[channel.program] : null;
  const isAdmin = profile.role === "admin" || profile.role === "owner";

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
      <TopBar
        accent={program?.accent}
        title={
          <>
            <span className="text-muted-foreground font-sans text-[17px] font-medium" aria-hidden>
              {isClientChannel ? (
                <Lock className="inline size-4 -translate-y-px" />
              ) : channel.staff_only ? (
                <Inbox className="inline size-4 -translate-y-px" />
              ) : channel.type === "announcement" ? (
                ""
              ) : (
                "#"
              )}
            </span>
            <span className="truncate">{channel.name}</span>
            {program && <span className="sr-only">, {program.label}</span>}
          </>
        }
        subtitle={channel.description}
        actions={
          !isAdmin ? undefined : isClientChannel ? <ClientChannelMenu channel={channel} /> : <ChannelMenu channelId={channel.id} />
        }
      />
      {channel.staff_only && channel.slug === "coachos-email-ticket" && <MailboxStatus />}

      <MessageList
        ref={list}
        items={items}
        myId={profile.id}
        iAmStaff={isStaff}
        timeZone={timeZone}
        hasOlder={Boolean(chat.hasOlder)}
        loadingOlder={chat.loadingOlder}
        loadOlder={() => void chat.loadOlder()}
        onAtBottomChange={setAtBottom}
        newWhileAway={newWhileAway}
        onReact={chat.toggleReaction}
        onEdit={chat.edit}
        onDelete={chat.remove}
        onRetry={chat.retry}
        onCreateTicket={isStaff ? setTicketFrom : undefined}
        canCreateTicket={canCreateTicket}
        onOpenThread={openThread}
        highlightId={channelHighlight}
        intro={
          <div className="px-4 pt-10 pb-2 md:px-6 md:pt-14">
            <p className="note text-muted-foreground flex items-center gap-2 text-[15px]">
              <Icon className="size-4 not-italic" aria-hidden />
              {isClientChannel
                ? `Private · ${program?.label}`
                : channel.staff_only
                  ? "Team only"
                  : program
                    ? `${program.label} members`
                    : "Everyone in the hub"}
            </p>
            <h2 className="font-display mt-1 text-[34px] leading-[1.05] tracking-tight md:text-[44px]">
              The start of {channel.type === "announcement" ? "" : "#"}
              {channel.name}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-prose text-[15px] leading-relaxed">
              {channel.staff_only
                ? "Every email to CoachOS@AliveAndFreeConsulting.com lands here. Clients' emails open tickets automatically; anyone else shows up as a card for the team to handle. Only the team can see this channel."
                : isClientChannel
                ? channel.client_id === profile.id
                  ? "Your private space with the Alive + Free team. Only you and the team can see it, so share anything about your setup, your questions or your plans."
                  : "Only this client and the team can see this channel."
                : `${channel.description ? `${channel.description}. ` : ""}${
                    canPost
                      ? "Say hello, ask a question, or share what you're working on."
                      : "The team posts news and updates here. React to let us know you've seen them."
                  }`}
            </p>
          </div>
        }
      />

      {isStaff && <TicketFromMessageDialog message={ticketFrom} onOpenChange={(open) => !open && setTicketFrom(null)} />}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <TypingIndicator typers={typing.typers} />
      {canPost ? (
        <Composer
          draftId={channel.id}
          placeholder={`Message #${channel.name}`}
          onSend={send}
          mentionScope={{ channelId: channel.id }}
          onTyping={typing.typing}
          onStopTyping={typing.stopped}
        />
      ) : (
        <ReadOnlyNotice channelName={channel.name} />
      )}
      </div>

      {threadId && (
        <ThreadPanel
          key={threadId}
          channel={channel}
          parentId={threadId}
          parent={threadParent}
          parentActions={{ onReact: chat.toggleReaction, onEdit: chat.edit, onDelete: chat.remove, onRetry: chat.retry }}
          highlightId={threadHighlight}
          onClose={closeThread}
        />
      )}
    </div>
  );
}
