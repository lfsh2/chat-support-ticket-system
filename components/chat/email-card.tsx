"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Mail, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markEmailHandled } from "@/app/(hub)/c/actions";
import type { EmailCardMeta } from "@/lib/email/card";
import type { ChatMessage } from "@/lib/chat/types";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const HEADLINE: Record<EmailCardMeta["kind"], string> = {
  new_ticket: "New email ticket",
  reply: "Replied by email",
  unmatched: "New email · not a client yet",
};

/** One email to CoachOS@, as it appears in the team's #coachos-email-ticket feed. */
export function EmailCard({ message, timeZone }: { message: ChatMessage; timeZone: string }) {
  const meta = message.meta as unknown as EmailCardMeta | null;
  const [pending, startTransition] = useTransition();
  if (!meta) return null;

  const handled = Boolean(meta.handled_at);
  const needsAction = meta.kind === "unmatched" && !handled;
  const who = meta.from_name ? `${meta.from_name} <${meta.from_email}>` : meta.from_email;

  const markHandled = () =>
    startTransition(async () => {
      const res = await markEmailHandled(meta.inbound_id, message.id);
      if (!res.ok) toast.error(res.error);
    });

  return (
    <article
      id={`message-${message.id}`}
      className="px-4 py-1.5 md:px-6"
      aria-label={`${HEADLINE[meta.kind]} from ${meta.from_name ?? meta.from_email}`}
    >
      <div
        className={cn(
          "bg-card border-rule max-w-2xl rounded-xl border border-l-[3px] px-4 py-3",
          needsAction ? "border-l-warning" : "border-l-ink/40",
          handled && "opacity-70",
        )}
      >
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <Mail className="size-3.5" aria-hidden />
          <span className={cn("font-semibold", needsAction ? "text-warning" : "text-foreground/80")}>{HEADLINE[meta.kind]}</span>
          <span aria-hidden>·</span>
          <time dateTime={message.created_at ?? undefined} className="tabular-nums">
            {formatTime(new Date(message.created_at ?? 0), timeZone)}
          </time>
        </div>
        <p className="mt-1.5 truncate text-[13px]" title={who}>
          <span className="text-muted-foreground">From </span>
          <span className="font-medium">{meta.from_name ?? meta.from_email}</span>
          {meta.from_name && <span className="text-muted-foreground"> · {meta.from_email}</span>}
        </p>
        <h3 className="mt-0.5 text-[15px] leading-snug font-semibold">{meta.subject}</h3>
        {meta.preview && <p className="text-muted-foreground mt-1 line-clamp-3 text-sm leading-relaxed">{meta.preview}</p>}
        {meta.attachments > 0 && (
          <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
            <Paperclip className="size-3.5" aria-hidden /> {meta.attachments} {meta.attachments === 1 ? "attachment" : "attachments"}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {meta.ticket_number ? (
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/tickets/${meta.ticket_number}`} />}
              className="bg-ink text-background hover:bg-ink/90 h-9 cursor-pointer px-3 text-[13px] font-semibold"
            >
              Open ticket #{meta.ticket_number}
            </Button>
          ) : null}
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={meta.gmail_url} target="_blank" rel="noopener noreferrer" />}
            className="h-9 cursor-pointer gap-1.5 px-3 text-[13px]"
          >
            Open in Gmail <ExternalLink className="size-3.5" aria-hidden />
          </Button>
          {needsAction && (
            <Button variant="ghost" className="h-9 cursor-pointer gap-1.5 px-3 text-[13px]" onClick={markHandled} disabled={pending}>
              <CheckCircle2 className="size-4" aria-hidden /> {pending ? "Saving…" : "Mark handled"}
            </Button>
          )}
          {handled && (
            <span className="text-success flex items-center gap-1 text-xs font-semibold">
              <CheckCircle2 className="size-3.5" aria-hidden /> Handled by {meta.handled_by}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
