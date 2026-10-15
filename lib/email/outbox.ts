import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { buildRawEmail, ticketEmailBodies } from "./mime";

type Db = SupabaseClient<Database>;

export type MailSender = {
  /** Sends a raw base64url message; returns Gmail's ids. */
  send(raw: string, threadId: string | null): Promise<{ id: string; threadId: string }>;
};

const MAX_ATTEMPTS = 5;
/** A reply that couldn't go out within a day is stale; better unsent than a confusing late email. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RESOLVED_TEXT =
  "We've marked this as resolved. If it isn't sorted yet, just reply to this email and we'll pick it straight back up.";

/**
 * Sends what's waiting in email_outbox: team replies typed in the hub, and "resolved"
 * notices. Each goes from the CoachOS mailbox into the ticket's Gmail thread (a new thread
 * the first time a web ticket gets a reply), so the client can simply reply to the email.
 */
export async function flushOutbox(db: Db, sender: MailSender, opts: { inbox: string; appUrl: string }) {
  const { data: queue } = await db
    .from("email_outbox")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(25);

  let sent = 0;
  for (const job of queue ?? []) {
    try {
      const outcome = await sendOne(db, sender, opts, job);
      if (outcome === "sent") sent++;
    } catch (err) {
      const attempts = job.attempts + 1;
      await db
        .from("email_outbox")
        .update({
          attempts,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          last_error: err instanceof Error ? err.message.slice(0, 500) : String(err),
        })
        .eq("id", job.id);
    }
  }
  return { sent, checked: queue?.length ?? 0 };
}

async function sendOne(
  db: Db,
  sender: MailSender,
  opts: { inbox: string; appUrl: string },
  job: Database["public"]["Tables"]["email_outbox"]["Row"],
): Promise<"sent" | "skipped"> {
  const skip = async (reason: string) => {
    await db.from("email_outbox").update({ status: "skipped", last_error: reason }).eq("id", job.id);
    return "skipped" as const;
  };
  if (Date.now() - new Date(job.created_at).getTime() > MAX_AGE_MS) return skip("older than a day; not sent");

  const { data: ticket } = await db
    .from("tickets")
    .select("id, number, subject, requester:profiles!tickets_requester_id_fkey(email, display_name, role)")
    .eq("id", job.ticket_id)
    .single();
  const requester = ticket?.requester as { email: string; display_name: string; role: string } | null | undefined;
  if (!ticket || !requester?.email) return skip("ticket or client email missing");
  if (requester.role !== "member") return skip("requester is on the team");

  let message = RESOLVED_TEXT;
  let signedBy = "The Alive + Free team";
  if (job.kind === "reply") {
    const { data: m } = await db
      .from("messages")
      .select("body, kind, deleted_at, author:profiles!messages_author_id_fkey(display_name)")
      .eq("id", job.message_id ?? "")
      .maybeSingle();
    if (!m || m.deleted_at || m.kind !== "user" || !m.body.trim()) return skip("message deleted, empty or internal");
    message = m.body;
    signedBy = (m.author as { display_name: string } | null)?.display_name.replace(/\s*\(.*?\)\s*/g, " ").trim() || signedBy;
  }

  const { data: thread } = await db.from("mail_threads").select("*").eq("ticket_id", ticket.id).maybeSingle();
  const subject = thread ? `Re: ${thread.subject}` : `[#${ticket.number}] ${ticket.subject}`;
  const ticketUrl = `${opts.appUrl}/dashboard/tickets/${ticket.number}`;
  const { text, html } = ticketEmailBodies({ message, signedBy, ticketUrl, ticketNumber: ticket.number });
  const raw = buildRawEmail({
    from: `Alive + Free Support <${opts.inbox}>`,
    to: requester.display_name ? `"${requester.display_name.replace(/"/g, "")}" <${requester.email}>` : requester.email,
    subject,
    text,
    html,
    inReplyTo: thread?.last_message_id_header ?? null,
    references: thread?.last_message_id_header ?? null,
  });

  const result = await sender.send(raw, thread?.gmail_thread_id ?? null);
  if (!thread) {
    await db.from("mail_threads").insert({ gmail_thread_id: result.threadId, ticket_id: ticket.id, subject: subject });
  }
  await db
    .from("email_outbox")
    .update({ status: "sent", sent_at: new Date().toISOString(), gmail_message_id: result.id, attempts: job.attempts + 1, last_error: null })
    .eq("id", job.id);
  return "sent";
}
