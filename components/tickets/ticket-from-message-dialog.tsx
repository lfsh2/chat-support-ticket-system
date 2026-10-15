"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ResponsiveDialog } from "@/components/shell/responsive-dialog";
import { createTicketFromMessage, type TicketFromChatInput } from "@/app/(hub)/c/actions";
import type { ChatMessage } from "@/lib/chat/types";
import { toPlainText } from "@/lib/markdown";
import { CATEGORY_LABEL, CATEGORY_ORDER, PRIORITY_LABEL, PRIORITY_ORDER } from "@/lib/tickets";

/** First line of the message, trimmed to a sensible ticket subject. */
export function subjectFrom(body: string) {
  const line = toPlainText(body).split("\n").find((l) => l.trim())?.trim() ?? "";
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : 80)}…`;
}

/** Team: turn a chat message into a ticket for that client. */
export function TicketFromMessageDialog({
  message,
  onOpenChange,
}: {
  message: ChatMessage | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Omit<TicketFromChatInput, "messageId">>({
    subject: "",
    category: "other",
    priority: "normal",
    assignToMe: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Fresh form for each message (not on every re-render).
  const [forId, setForId] = useState<string | null>(null);
  if (message && message.id !== forId) {
    setForId(message.id);
    setForm({ subject: subjectFrom(message.body), category: "other", priority: "normal", assignToMe: true });
    setError(null);
  }

  const submit = () => {
    if (!message) return;
    setError(null);
    startTransition(async () => {
      const res = await createTicketFromMessage({ messageId: message.id, ...form });
      if (!res.ok || !res.number) return setError(res.ok ? "Something went wrong." : res.error);
      onOpenChange(false);
      const number = res.number;
      toast.success(`Ticket #${number} created.`, {
        description: "The client can see it under Help.",
        action: { label: "Open", onClick: () => router.push(`/dashboard/tickets/${number}`) },
      });
    });
  };

  const author = message?.author?.display_name ?? "the client";

  return (
    <ResponsiveDialog
      open={message !== null}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title="Create a ticket"
      description="The message becomes the ticket's first message, and the client can follow it under Help."
    >
      {message && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <blockquote className="border-rule bg-muted/50 rounded-lg border-l-[3px] px-3 py-2 text-sm">
            <p className="text-muted-foreground mb-0.5 text-xs font-semibold">{author} wrote</p>
            <p className="line-clamp-4 whitespace-pre-line">{toPlainText(message.body) || "(attachment)"}</p>
          </blockquote>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tfm-subject">Subject</Label>
            <Input
              id="tfm-subject"
              autoFocus
              required
              maxLength={160}
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="h-11 text-base md:text-[15px]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tfm-category">Topic</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as TicketFromChatInput["category"] }))}
                items={CATEGORY_LABEL}
              >
                <SelectTrigger id="tfm-category" className="h-11 w-full text-base md:text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tfm-priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TicketFromChatInput["priority"] }))}
                items={PRIORITY_LABEL}
              >
                <SelectTrigger id="tfm-priority" className="h-11 w-full text-base md:text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
            <span className="text-sm font-medium">Assign it to me</span>
            <Switch checked={form.assignToMe} onCheckedChange={(v) => setForm((f) => ({ ...f, assignToMe: v }))} />
          </label>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" className="h-11 cursor-pointer px-4" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || form.subject.trim().length < 3}
              className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold"
            >
              {pending ? "Creating…" : "Create ticket"}
            </Button>
          </div>
        </form>
      )}
    </ResponsiveDialog>
  );
}
