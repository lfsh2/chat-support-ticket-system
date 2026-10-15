import { NextResponse, type NextRequest } from "next/server";
import { canUseDevLogin } from "@/lib/dev-login";
import { processInboundEmail } from "@/lib/email/inbox";
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
    from?: string;
    name?: string;
    subject?: string;
    text?: string;
    threadId?: string;
    labels?: string[];
    headers?: Record<string, string>;
  };

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
      { inbox: INBOX_ADDRESS, appUrl: publicOrigin(request) },
    );
    return NextResponse.json({ ...result, emails: sent });
  }

  const email: ParsedEmail = {
    gmailMessageId: `dev-${crypto.randomUUID()}`,
    gmailThreadId: body.threadId ?? `dev-thread-${crypto.randomUUID()}`,
    messageIdHeader: `<${crypto.randomUUID()}@dev.local>`,
    inReplyTo: null,
    fromEmail: (body.from ?? "someone@example.org").toLowerCase(),
    fromName: body.name ?? null,
    to: [INBOX_ADDRESS],
    subject: body.subject ?? "Hello",
    text: stripQuoted(body.text ?? ""), // as parseGmailMessage does for real mail
    receivedAt: new Date().toISOString(),
    labels: body.labels ?? ["INBOX", "CATEGORY_PERSONAL"],
    headers: body.headers ?? {},
    attachments: [],
  };
  const outcome = await processInboundEmail(db, email, { inbox: INBOX_ADDRESS, fetchAttachment: null });
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
