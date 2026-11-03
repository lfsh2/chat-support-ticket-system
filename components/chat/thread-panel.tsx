"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useHub } from "@/components/shell/hub-context";
import { useMessages } from "@/hooks/use-channel-messages";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTyping } from "@/hooks/use-typing";
import { buildListItems } from "@/lib/chat/group";
import { MESSAGE_SELECT, type ChatMessage } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";
import { safeTimeZone } from "@/lib/time";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { MessageList, type MessageListHandle } from "./message-list";
import { TypingIndicator } from "./typing-indicator";

type ThreadChannel = { id: string; name: string };

/** Reactions, edits and deletes on the parent go through the channel's own message cache. */
export type ParentActions = {
  onReact: (message: ChatMessage, emoji: string) => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRetry: (id: string) => void;
};

type Props = {
  channel: ThreadChannel;
  parentId: string;
  /** The parent from the channel's loaded messages, when it's there. */
  parent: ChatMessage | null;
  parentActions: ParentActions;
  /** A reply to scroll to and flash (from the Inbox). */
  highlightId?: string | null;
  onClose: () => void;
};

const noSubscribe = () => () => {};

/** Desktop ≥ 1024px: a column beside the channel. 768–1023px: a sheet. Phones: a drawer. */
export function ThreadPanel(props: Props) {
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const isMobile = useIsMobile();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const close = (open: boolean) => !open && props.onClose();
  if (!mounted) return null;

  if (isWide) {
    return (
      <aside aria-label="Thread" className="paper border-rule flex w-[400px] shrink-0 flex-col border-l xl:w-[440px]">
        <ThreadBody {...props} Title="h2" />
      </aside>
    );
  }

  if (isMobile) {
    return (
      <Drawer open onOpenChange={close}>
        <DrawerContent
          // Full height of what's visible, and lifted above the on-screen keyboard.
          className="paper rounded-t-2xl [--drawer-content-height:calc(var(--app-height,100dvh)-env(safe-area-inset-top)-0.75rem)] [--drawer-content-max-height:none]"
          style={{ bottom: "var(--keyboard-inset, 0px)" }}
        >
          <div className="bg-foreground/15 mx-auto mt-2 h-1 w-10 shrink-0 rounded-full" aria-hidden />
          <ThreadBody {...props} Title={DrawerTitle} Description={DrawerDescription} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open onOpenChange={close}>
      <SheetContent side="right" showCloseButton={false} className="paper w-[min(26rem,100vw)] gap-0 p-0 sm:max-w-none">
        <ThreadBody {...props} Title={SheetTitle} Description={SheetDescription} />
      </SheetContent>
    </Sheet>
  );
}

type TitleComponent = "h2" | React.ComponentType<{ className?: string; children?: React.ReactNode }>;

function ThreadBody({
  channel,
  parentId,
  parent: cached,
  parentActions,
  highlightId,
  onClose,
  Title,
  Description,
}: Props & { Title: TitleComponent; Description?: React.ComponentType<{ className?: string; children?: React.ReactNode }> }) {
  const { profile, isStaff, refreshInbox } = useHub();
  const timeZone = safeTimeZone(profile.timezone);
  const isMobile = useIsMobile();
  const supabase = useMemo(() => createClient(), []);
  const me = useMemo(
    () => ({ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url, role: profile.role }),
    [profile],
  );

  // Deep links to an older thread: the parent may not be among the channel's loaded messages.
  const fetched = useQuery({
    queryKey: ["message", parentId],
    enabled: !cached,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select(MESSAGE_SELECT).eq("id", parentId).maybeSingle();
      return (data as unknown as ChatMessage | null) ?? null;
    },
  });
  const parent = cached ?? fetched.data ?? null;
  const missing = !cached && fetched.isFetched && !fetched.data;

  const thread = useMessages({ scope: { column: "channel_id", id: channel.id, parentId }, me });
  const items = useMemo(
    () => buildListItems(thread.messages, { currentUserId: profile.id, timeZone }),
    [thread.messages, profile.id, timeZone],
  );

  // Opening the thread (and replies arriving while it's open) clears its Inbox items.
  const newestReply = thread.messages[thread.messages.length - 1]?.id;
  useEffect(() => {
    if (document.visibilityState !== "visible") return;
    supabase.rpc("clear_notifications", { pid: parentId }).then(({ data }) => {
      if (data) refreshInbox();
    });
  }, [supabase, parentId, newestReply, refreshInbox]);

  const typingMe = useMemo(() => ({ id: profile.id, name: profile.display_name }), [profile.id, profile.display_name]);
  const typing = useTyping(`thread:${parentId}`, typingMe);

  const list = useRef<MessageListHandle>(null);
  const send = useCallback(
    (body: string, files: File[]) => {
      const ok = thread.send(body, files);
      if (ok) requestAnimationFrame(() => list.current?.scrollToBottom(false));
      return ok;
    },
    [thread],
  );

  const replies = parent?.reply_count ?? thread.messages.length;
  const canReply = Boolean(parent && !parent.deleted_at);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-rule flex min-h-14 shrink-0 items-center gap-2 border-b pr-2 pl-4 md:min-h-16">
        <div className="min-w-0 flex-1">
          <Title className="font-display text-[20px] leading-tight font-normal tracking-tight">Thread</Title>
          {Description ? (
            <Description className="text-muted-foreground truncate text-xs">in #{channel.name}</Description>
          ) : (
            <p className="text-muted-foreground truncate text-xs">in #{channel.name}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="size-11 cursor-pointer" onClick={onClose} aria-label="Close thread">
          <X className="size-5" />
        </Button>
      </header>

      {missing ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="font-display text-[22px]">This conversation isn&apos;t available.</p>
          <p className="text-muted-foreground text-sm">It may have been removed, or you may no longer have access to it.</p>
        </div>
      ) : (
        <MessageList
          ref={list}
          items={items}
          myId={profile.id}
          iAmStaff={isStaff}
          timeZone={timeZone}
          hasOlder={Boolean(thread.hasOlder)}
          loadingOlder={thread.loadingOlder}
          loadOlder={() => void thread.loadOlder()}
          onAtBottomChange={() => {}}
          newWhileAway={0}
          onReact={thread.toggleReaction}
          onEdit={thread.edit}
          onDelete={thread.remove}
          onRetry={thread.retry}
          highlightId={highlightId}
          intro={
            <div className="pt-2">
              {parent ? (
                <MessageItem
                  // The reply count is the line just below; don't repeat it on the parent.
                  message={parent.reply_count ? { ...parent, reply_count: 0 } : parent}
                  isGroupStart
                  myId={profile.id}
                  iAmStaff={isStaff}
                  timeZone={timeZone}
                  domId={`thread-parent-${parent.id}`}
                  {...parentActions}
                />
              ) : (
                <div className="space-y-2 px-4 py-3 md:px-6" aria-label="Loading">
                  <div className="bg-muted h-3 w-32 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
                </div>
              )}
              <p className="note text-muted-foreground border-rule mx-4 mt-3 mb-1 border-b pb-1.5 text-[14px] md:mx-6">
                {thread.loading
                  ? "Loading replies…"
                  : replies === 0
                    ? "No replies yet. Start the conversation."
                    : `${replies} ${replies === 1 ? "reply" : "replies"}`}
              </p>
            </div>
          }
        />
      )}

      {canReply && (
        <>
          <TypingIndicator typers={typing.typers} />
          <Composer
            draftId={`thread:${parentId}`}
            placeholder="Reply in thread"
            onSend={send}
            mentionScope={{ channelId: channel.id }}
            onTyping={typing.typing}
            onStopTyping={typing.stopped}
            autoFocus={!isMobile}
          />
        </>
      )}
    </div>
  );
}
