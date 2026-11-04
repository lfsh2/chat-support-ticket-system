import { NextResponse, type NextRequest } from "next/server";
import { canUseDevLogin } from "@/lib/dev-login";
import { EMAIL_FEED_SLUG } from "@/lib/email/card";
import { processInboundEmail } from "@/lib/email/inbox";
import type { Mailbox } from "@/lib/email/mailbox";
import { flushOutbox } from "@/lib/email/outbox";
import { stripQuoted, type ParsedEmail } from "@/lib/email/parse";
import { INBOX_ADDRESS } from "@/lib/gmail/client";
import { createAdminClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/url";

/**
 * Local development only (same gate as the dev sign-in): push a pretend email through the
 * real inbox pipeline, or flush the outbox into a pretend mailbox, so the email features
 * can be exercised and tested without Gmail. 404 everywhere else.
 */
export async function POST(request: NextRequest) {
  if (!canUseDevLogin()) return new NextResponse("Not found", { status: 404 });
  const db = createAdminClient();
  const body = (await request.json()) as {
    action?: "receive" | "flush";
    /** Which mailbox it arrives in / sends from (default: the CoachOS one). */
    inbox?: string;
    from?: string;
    name?: string;
    subject?: string;
    text?: string;
    threadId?: string;
    /** The RFC Message-ID (the same in every mailbox a message reaches). */
    messageId?: string;
    labels?: string[];
    headers?: Record<string, string>;
  };

  // Mailboxes as the real sync sees them; the CoachOS one is assumed even when not "connected" locally.
  const { data: connections } = await db.from("mail_connections").select("email, program, channel_id").order("connected_at");
  const { data: coachosFeed } = await db.from("channels").select("id").eq("slug", EMAIL_FEED_SLUG).maybeSingle();
  const mailboxes: Mailbox[] = (connections ?? []).map((c) => ({ email: c.email.toLowerCase(), program: c.program, channelId: c.channel_id }));
  if (!mailboxes.some((m) => m.email === INBOX_ADDRESS)) {
    mailboxes.unshift({ email: INBOX_ADDRESS, program: "coachos", channelId: coachosFeed?.id ?? null });
  }
  const inbox = (body.inbox ?? INBOX_ADDRESS).toLowerCase();
  const mailbox = mailboxes.find((m) => m.email === inbox);
  if (!mailbox) return NextResponse.json({ error: `No mailbox ${inbox} is connected locally.` }, { status: 400 });

  if (body.action === "flush") {
    const sent: { to: string; subject: string; threadId: string | null }[] = [];
    const result = await flushOutbox(
      db,
      {
        async send(raw, threadId) {
          const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
          sent.push({
            to: decoded.match(/^To: (.*)$/m)?.[1] ?? "",
            subject: decoded.match(/^Subject: (.*)$/m)?.[1] ?? "",
            threadId,
          });
          return { id: `dev-sent-${crypto.randomUUID()}`, threadId: threadId ?? `dev-thread-${crypto.randomUUID()}` };
        },
      },
      { inbox, appUrl: publicOrigin(request), mailboxes },
    );
    return NextResponse.json({ ...result, emails: sent });
  }

  const email: ParsedEmail = {
    gmailMessageId: `dev-${crypto.randomUUID()}`,
    gmailThreadId: body.threadId ?? `dev-thread-${crypto.randomUUID()}`,
    messageIdHeader: body.messageId ?? `<${crypto.randomUUID()}@dev.local>`,
    inReplyTo: null,
    fromEmail: (body.from ?? "someone@example.org").toLowerCase(),
    fromName: body.name ?? null,
    to: [inbox],
    subject: body.subject ?? "Hello",
    text: stripQuoted(body.text ?? ""), // as parseGmailMessage does for real mail
    receivedAt: new Date().toISOString(),
    labels: body.labels ?? ["INBOX", "CATEGORY_PERSONAL"],
    headers: body.headers ?? {},
    attachments: [],
  };
  const outcome = await processInboundEmail(db, email, {
    inbox,
    program: mailbox.program,
    feedChannelId: mailbox.channelId,
    fetchAttachment: null,
  });
  const { data: row } = await db
    .from("inbound_emails")
    .select("ticket_id, tickets(number)")
    .eq("gmail_message_id", email.gmailMessageId)
    .maybeSingle();
  return NextResponse.json({
    outcome,
    threadId: email.gmailThreadId,
    ticketNumber: (row?.tickets as { number: number } | null)?.number ?? null,
  });
}
