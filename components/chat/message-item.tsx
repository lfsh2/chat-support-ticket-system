"use client";

import { memo, useCallback, useState } from "react";
import { AlertCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shell/user-avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/use-long-press";
import { isStaffRole } from "@/lib/access";
import { toPlainText } from "@/lib/markdown";
import { formatTime, formatTimeShort } from "@/lib/time";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { AttachmentPreview } from "./attachment-preview";
import { MessageBody } from "./message-body";
import { MessageActionDrawer, MessageContextMenu, MessageToolbar, type MessageActionHandlers } from "./message-actions";
import { ReactionBar } from "./reaction-bar";

type Props = {
  message: ChatMessage;
  isGroupStart: boolean;
  myId: string;
  iAmStaff: boolean;
  timeZone: string;
  onReact: (message: ChatMessage, emoji: string) => void;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRetry: (id: string) => void;
};

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (body: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const save = () => {
    const body = value.trim();
    if (!body || body === initial) return onCancel();
    onSave(body);
  };
  return (
    <div className="mt-1 flex flex-col gap-2">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          }
        }}
        aria-label="Edit message"
        className="max-h-60 min-h-11 resize-none rounded-xl text-base md:text-[15px]"
      />
      <div className="flex items-center gap-2 text-xs">
        <Button size="sm" className="h-9 px-3" onClick={save}>
          Save
        </Button>
        <Button size="sm" variant="ghost" className="h-9 px-3" onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-muted-foreground hidden md:inline">Enter to save · Esc to cancel</span>
      </div>
    </div>
  );
}

export const MessageItem = memo(function MessageItem({
  message,
  isGroupStart,
  myId,
  iAmStaff,
  timeZone,
  onReact,
  onEdit,
  onDelete,
  onRetry,
}: Props) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mine = message.author_id === myId;
  const deleted = message.deleted_at != null;
  const at = new Date(message.created_at ?? 0);
  const authorName = message.author?.display_name ?? "Someone";
  const settled = !message.status;

  const handlers: MessageActionHandlers = {
    canEdit: mine && settled && !deleted,
    canDelete: (mine || iAmStaff) && !deleted,
    onReact: (emoji) => onReact(message, emoji),
    onCopy: () => {
      void navigator.clipboard?.writeText(message.body).then(() => toast.success("Copied"));
    },
    onEdit: () => setEditing(true),
    onDelete: () => setConfirmDelete(true),
  };

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const longPress = useLongPress(openDrawer);
  const interactive = settled && !deleted && !editing;

  const row = (
    <div
      {...(interactive && isMobile ? longPress : {})}
      id={`message-${message.id}`}
      className={cn(
        "group/message relative flex gap-3 px-4 transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] md:px-6",
        isGroupStart ? "mt-2.5 pt-1.5 pb-0.5" : "py-0.5",
        message.status === "sending" && "opacity-60",
        message.status && "animate-in slide-in-from-bottom-2 fade-in motion-reduce:animate-none duration-200",
        "select-none md:select-text",
      )}
    >
      <div className="w-9 shrink-0">
        {isGroupStart ? (
          <UserAvatar name={authorName} src={message.author?.avatar_url} seed={message.author_id ?? undefined} />
        ) : (
          <time
            dateTime={message.created_at ?? undefined}
            className="text-muted-foreground hidden pt-[3px] text-right text-[11px] leading-5 tabular-nums group-hover/message:block"
          >
            {formatTimeShort(at, timeZone)}
          </time>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {isGroupStart && (
          <div className="flex flex-wrap items-baseline gap-x-2 leading-5">
            <span className="text-[15px] font-semibold tracking-[-0.005em]">{authorName}</span>
            {isStaffRole(message.author?.role) && (
              <span className="note text-muted-foreground text-[14px] leading-none">team</span>
            )}
            <time dateTime={message.created_at ?? undefined} className="text-muted-foreground text-xs tabular-nums">
              {formatTime(at, timeZone)}
            </time>
          </div>
        )}

        {deleted ? (
          <p className="text-muted-foreground text-[15px] italic">This message was deleted.</p>
        ) : editing ? (
          <EditBox
            initial={message.body}
            onCancel={() => setEditing(false)}
            onSave={(body) => {
              setEditing(false);
              void onEdit(message.id, body);
            }}
          />
        ) : (
          <>
            {message.body && <MessageBody body={message.body} />}
            {message.edited_at && <span className="text-muted-foreground text-xs"> (edited)</span>}
            <AttachmentPreview attachments={message.attachments} />
          </>
        )}

        {message.status === "failed" && (
          <div className="text-destructive mt-1 flex items-center gap-2 text-sm" role="alert">
            <AlertCircle className="size-4" aria-hidden />
            Couldn&apos;t send.
            <Button variant="link" className="text-destructive h-auto p-0 font-semibold" onClick={() => onRetry(message.id)}>
              Retry
            </Button>
            <Button variant="link" className="text-muted-foreground h-auto p-0" onClick={() => void onDelete(message.id)}>
              Discard
            </Button>
          </div>
        )}
        {message.status === "sending" && <span className="sr-only">Sending</span>}

        {!deleted && <ReactionBar reactions={message.reactions} myId={myId} onToggle={handlers.onReact} />}

        {message.reply_count > 0 && (
          <p className="text-primary mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
            <MessageSquare className="size-3.5" aria-hidden />
            {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
          </p>
        )}
      </div>

      {interactive && !isMobile && <MessageToolbar {...handlers} />}
    </div>
  );

  return (
    <>
      {interactive && !isMobile ? (
        <ContextMenu>
          <ContextMenuTrigger render={<div />}>{row}</ContextMenuTrigger>
          <MessageContextMenu {...handlers} />
        </ContextMenu>
      ) : (
        row
      )}

      {isMobile && interactive && (
        <MessageActionDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          preview={toPlainText(message.body)}
          {...handlers}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              {mine ? "It will be removed for everyone." : `This removes ${authorName}'s message for everyone.`} This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              onClick={() => {
                setConfirmDelete(false);
                void onDelete(message.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
