"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListItem } from "@/lib/chat/group";
import type { ChatMessage } from "@/lib/chat/types";
import { MessageItem } from "./message-item";
import { DateDivider, UnreadDivider } from "./unread-divider";

export type MessageListHandle = { scrollToBottom: (smooth?: boolean) => void };

type Props = {
  items: ListItem[];
  myId: string;
  iAmStaff: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  onAtBottomChange: (atBottom: boolean) => void;
  newWhileAway: number;
  intro: React.ReactNode;
  onReact: (message: ChatMessage, emoji: string) => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRetry: (id: string) => void;
};

const BOTTOM_THRESHOLD = 80;

/**
 * Uses a column-reverse scroller: it starts at the bottom, stays pinned there as new
 * messages arrive, and keeps your place when older history is prepended above.
 */
export const MessageList = forwardRef<MessageListHandle, Props>(function MessageList(
  { items, hasOlder, loadingOlder, loadOlder, onAtBottomChange, newWhileAway, intro, ...itemProps },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  useImperativeHandle(ref, () => ({
    scrollToBottom: (smooth = true) => scroller.current?.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" }),
  }));

  // Load older history when the top sentinel scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasOlder) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingOlder) loadOlder();
      },
      { root: scroller.current, rootMargin: "400px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasOlder, loadingOlder, loadOlder]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    // In a column-reverse scroller, scrollTop is 0 at the bottom and negative going up.
    const next = Math.abs(el.scrollTop) < BOTTOM_THRESHOLD;
    if (next !== atBottom) {
      setAtBottom(next);
      onAtBottomChange(next);
    }
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex h-full flex-col-reverse overflow-x-hidden overflow-y-auto overscroll-contain"
        tabIndex={-1}
      >
        <div className="flex flex-col pb-3">
          <div ref={sentinel} aria-hidden className="h-px" />
          {hasOlder ? (
            loadingOlder && (
              <div className="space-y-4 px-4 py-4 md:px-6" aria-label="Loading older messages">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            intro
          )}
          <div role="log" aria-label="Messages" aria-live="off">
            {items.map((item) => {
              if (item.type === "date") return <DateDivider key={item.key} date={item.date} />;
              if (item.type === "unread") return <UnreadDivider key={item.key} />;
              return (
                <MessageItem key={item.key} message={item.message} isGroupStart={item.isGroupStart} {...itemProps} />
              );
            })}
          </div>
        </div>
      </div>

      {!atBottom && (
        <Button
          onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="animate-in fade-in slide-in-from-bottom-2 bg-ink text-background hover:bg-ink/90 absolute right-4 bottom-3 h-10 cursor-pointer gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold motion-reduce:animate-none md:right-6"
        >
          <ArrowDown className="size-4" aria-hidden />
          {newWhileAway > 0 ? `${newWhileAway} new ${newWhileAway === 1 ? "message" : "messages"}` : "Jump to latest"}
        </Button>
      )}
    </div>
  );
});
