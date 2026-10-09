"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TopBar } from "@/components/shell/top-bar";
import { UserAvatar } from "@/components/shell/user-avatar";
import { useHub } from "@/components/shell/hub-context";
import { Composer } from "@/components/chat/composer";
import { MessageList, type MessageListHandle } from "@/components/chat/message-list";
import { useMessages, type SendKind } from "@/hooks/use-channel-messages";
import { createClient } from "@/lib/supabase/client";
import { buildListItems } from "@/lib/chat/group";
import type { ChatMessage } from "@/lib/chat/types";
import type { Tables } from "@/lib/database.types";
import { PROGRAMS } from "@/lib/config";
import { toPlainText } from "@/lib/markdown";
import { dayLabel, safeTimeZone } from "@/lib/time";
import { CATEGORY_LABEL } from "@/lib/tickets";
import { SatisfactionPrompt } from "./satisfaction-prompt";
import { TicketPanel, type TicketPanelData } from "./ticket-panel";
import { PriorityTag, ProgramTag, StatusBadge } from "./ticket-tags";

type Person = { id: string; display_name: string; avatar_url: string | null };
export type TicketDetail = Tables<"tickets"> & { requester: Person | null; assignee: Person | null };

export function TicketView({
  ticket,
  initialMessages,
  panel,
}: {
  ticket: TicketDetail;
  initialMessages: ChatMessage[];
  /** Staff only: data for the workspace panel. */
  panel: TicketPanelData | null;
}) {
  const { profile, isStaff } = useHub();
  const router = useRouter();
  const timeZone = safeTimeZone(profile.timezone);
  const supabase = useMemo(() => createClient(), []);
  const me = useMemo(
    () => ({ id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url, role: profile.role }),
    [profile],
  );
  const chat = useMessages({ scope: { column: "ticket_id", id: ticket.id }, me, initialMessages });
  const list = useRef<MessageListHandle>(null);
  const items = useMemo(
    () => buildListItems(chat.messages, { currentUserId: profile.id, timeZone }),
    [chat.messages, profile.id, timeZone],
  );

  // Status / assignee / rating changes made elsewhere → re-render the server parts.
  // (Every message also bumps updated_at; those are ignored.)
  const watched = useRef(ticket);
  useEffect(() => {
    watched.current = ticket;
  }, [ticket]);
  useEffect(() => {
    const sub = supabase
      .channel(`ticket:${ticket.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${ticket.id}` }, (payload) => {
        const row = payload.new as Tables<"tickets">;
        const cur = watched.current;
        if (
          row.status !== cur.status ||
          row.assignee_id !== cur.assignee_id ||
          row.priority !== cur.priority ||
          row.satisfaction !== cur.satisfaction
        )
          router.refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [supabase, ticket.id, router]);

  // Screen readers hear replies as they arrive.
  const newest = chat.messages[chat.messages.length - 1];
  const [announcement, setAnnouncement] = useState("");
  const lastAnnounced = useRef(newest?.id);
  useEffect(() => {
    if (!newest || newest.id === lastAnnounced.current) return;
    lastAnnounced.current = newest.id;
    if (newest.author_id !== profile.id && newest.kind !== "system") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors realtime arrivals into a live region
      setAnnouncement(`${newest.author?.display_name ?? "Someone"}: ${toPlainText(newest.body) || "sent an attachment"}`);
    }
  }, [newest, profile.id]);

  const [mode, setMode] = useState<SendKind>("user");
  const send = useCallback(
    (body: string, files: File[]) => {
      const ok = chat.send(body, files, isStaff ? mode : "user");
      if (ok) requestAnimationFrame(() => list.current?.scrollToBottom(false));
      return ok;
    },
    [chat, isStaff, mode],
  );

  const [detailsOpen, setDetailsOpen] = useState(false);
  const program = PROGRAMS[ticket.program];
  const audience = isStaff ? "staff" : "member";
  const isRequester = ticket.requester_id === profile.id;
  const closed = ticket.status === "closed";

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          accent={program.accent}
          leading={
            <Button
              variant="ghost"
              size="icon"
              className="size-11 cursor-pointer md:hidden"
              nativeButton={false}
              render={<Link href="/dashboard/tickets" aria-label="Back to tickets" />}
            >
              <ArrowLeft className="size-5" />
            </Button>
          }
          title={
            <>
              <span className="text-muted-foreground font-sans text-[17px] font-medium tabular-nums">#{ticket.number}</span>
              <span className="truncate">{ticket.subject}</span>
            </>
          }
          subtitle={<StatusBadge status={ticket.status} audience={audience} />}
          actions={
            <>
              <StatusBadge status={ticket.status} audience={audience} className="mr-1 md:hidden" />
              {panel && (
                <Button
                  variant="ghost"
                  className="h-11 cursor-pointer gap-2 px-3 lg:hidden"
                  onClick={() => setDetailsOpen(true)}
                  aria-label="Ticket details"
                >
                  <PanelRight className="size-5" aria-hidden />
                  <span className="hidden sm:inline">Details</span>
                </Button>
              )}
            </>
          }
        />

        <MessageList
          ref={list}
          items={items}
          myId={profile.id}
          iAmStaff={isStaff}
          timeZone={timeZone}
          hasOlder={Boolean(chat.hasOlder)}
          loadingOlder={chat.loadingOlder}
          loadOlder={() => void chat.loadOlder()}
          onAtBottomChange={() => {}}
          newWhileAway={0}
          onReact={chat.toggleReaction}
          onEdit={chat.edit}
          onDelete={chat.remove}
          onRetry={chat.retry}
          intro={
            <div className="px-4 pt-8 pb-2 md:px-6 md:pt-12">
              <p className="note text-muted-foreground text-[15px]">
                Ticket #{ticket.number} · opened {dayLabel(new Date(ticket.created_at ?? 0), timeZone).toLowerCase()}
                {!isRequester && ticket.requester ? ` by ${ticket.requester.display_name}` : ""}
              </p>
              <h2 className="font-display mt-1 text-[30px] leading-[1.1] tracking-tight md:text-[38px]">{ticket.subject}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <ProgramTag program={ticket.program} />
                <span className="text-muted-foreground text-[13px]">{CATEGORY_LABEL[ticket.category]}</span>
                <PriorityTag priority={ticket.priority} />
                {ticket.assignee ? (
                  <span className="text-muted-foreground flex items-center gap-1.5 text-[13px]">
                    <UserAvatar name={ticket.assignee.display_name} src={ticket.assignee.avatar_url} seed={ticket.assignee.id} className="size-5 text-[9px]" />
                    {ticket.assignee.id === profile.id ? "You're on it" : `${ticket.assignee.display_name} is on it`}
                  </span>
                ) : (
                  !isStaff && <span className="text-muted-foreground text-[13px]">We usually reply within one business day.</span>
                )}
              </div>
            </div>
          }
        />

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>

        {isRequester && ticket.status === "resolved" && <SatisfactionPrompt ticketId={ticket.id} satisfaction={ticket.satisfaction} />}

        {closed && !isStaff ? (
          <div className="border-rule text-muted-foreground mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] flex shrink-0 flex-wrap items-center gap-3 border-t pt-3 text-sm md:mx-6 md:mb-5">
            <p className="flex-1">This ticket is closed. Need more help? Open a new one and we&apos;ll pick it up.</p>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/tickets?new=1" />}
              className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-4 font-semibold"
            >
              Get help
            </Button>
          </div>
        ) : (
          <Composer
            draftId={`ticket:${ticket.id}`}
            placeholder={
              mode === "internal_note"
                ? "Add a note only the team can see"
                : isStaff
                  ? `Reply to ${ticket.requester?.display_name ?? "the client"}`
                  : ticket.status === "resolved"
                    ? "Reply to reopen this ticket"
                    : "Add a message for the team"
            }
            onSend={send}
            tone={mode === "internal_note" ? "note" : "default"}
          >
            {isStaff && (
              <ToggleGroup
                value={[mode]}
                onValueChange={(v) => v[0] && setMode(v[0] as SendKind)}
                size="sm"
                className="mb-1.5"
                aria-label="Message type"
              >
                <ToggleGroupItem value="user" className="data-pressed:bg-muted h-9 cursor-pointer px-3 text-[13px] font-semibold">
                  Reply
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="internal_note"
                  className="data-pressed:text-warning data-pressed:bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] h-9 cursor-pointer px-3 text-[13px] font-semibold"
                >
                  Internal note
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </Composer>
        )}
      </div>

      {panel && (
        <>
          <aside aria-label="Ticket details" className="border-rule hidden w-80 shrink-0 overflow-y-auto border-l lg:block">
            <TicketPanel {...panel} />
          </aside>
          <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
            <SheetContent side="right" className="paper w-[min(22rem,100vw)] gap-0 overflow-y-auto p-0 lg:hidden">
              <SheetHeader className="border-rule border-b px-5 pt-5 pb-3">
                <SheetTitle className="font-display text-[22px] font-normal">#{ticket.number} details</SheetTitle>
                <SheetDescription className="sr-only">Status, assignee, tasks and client info</SheetDescription>
              </SheetHeader>
              <TicketPanel {...panel} />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
