import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { membershipGrantsAccess, type Program } from "@/lib/access";
import { gmailThreadUrl, previewOf, type EmailCardMeta } from "./card";
import { ticketProgram } from "./mailbox";
import { cleanSubject, ignoreReason, type EmailAttachmentRef, type ParsedEmail } from "./parse";

type Db = SupabaseClient<Database>;
export type InboundOutcome = "duplicate" | "ignored" | "ticket" | "appended" | "unmatched" | "mirrored";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type InboxDeps = {
  /** The connected mailbox this email arrived in (coachos@, support@…), lower-case. */
  inbox: string;
  /** That mailbox's program: client emails open tickets there when the client has it. */
  program: Program | null;
  /** The team-only channel that mailbox's cards go to (null: no cards). */
  feedChannelId: string | null;
  /** Downloads an attachment's bytes, or null when attachments can't be fetched (tests). */
  fetchAttachment: ((ref: EmailAttachmentRef) => Promise<Buffer>) | null;
};

/**
 * One email from a connected mailbox → the hub:
 * - a client's new email opens a ticket (source 'email'); a reply in a known thread joins its ticket;
 * - anyone else gets a card in that mailbox's team-only channel for the team to handle;
 * - newsletters, receipts, auto-replies and bounces are logged and dropped;
 * - mail the team sent from Gmail itself is mirrored into the ticket it belongs to.
 * Idempotent on the Gmail message id. Mailboxes never mix: a thread only matches tickets that
 * came through the same mailbox, and one email sent to two connected mailboxes (To support@,
 * Cc coachos@) is handled once, by whichever reads it first.
 */
export async function processInboundEmail(db: Db, email: ParsedEmail, deps: InboxDeps): Promise<InboundOutcome> {
  const { data: seen } = await db.from("inbound_emails").select("id").eq("gmail_message_id", email.gmailMessageId).maybeSingle();
  if (seen) return "duplicate";
  if (email.labels.includes("DRAFT") || email.labels.includes("CHAT")) return "ignored";

  const { data: anyThread } = await db.from("mail_threads").select("*").eq("gmail_thread_id", email.gmailThreadId).maybeSingle();
  // Gmail thread ids belong to one mailbox; never join a ticket another mailbox owns.
  const thread = anyThread && (!anyThread.mailbox || anyThread.mailbox.toLowerCase() === deps.inbox) ? anyThread : null;

  // Sent from this mailbox: our own outbox email, or a teammate replying in Gmail.
  if (email.labels.includes("SENT") || email.fromEmail === deps.inbox) {
    const { data: ours } = await db.from("email_outbox").select("id").eq("gmail_message_id", email.gmailMessageId).maybeSingle();
    if (thread && email.messageIdHeader) {
      await db.from("mail_threads").update({ last_message_id_header: email.messageIdHeader }).eq("gmail_thread_id", email.gmailThreadId);
    }
    if (ours || !thread) {
      await log(db, deps, email, ours ? "mirrored" : "ignored", { ignore_reason: ours ? null : "sent from Gmail, not a ticket thread" });
      return ours ? "mirrored" : "ignored";
    }
    const message = await postTicketMessage(db, thread.ticket_id, null, email, deps, `${deps.inbox} (Gmail)`);
    await log(db, deps, email, "mirrored", { ticket_id: thread.ticket_id, hub_message_id: message });
    return "mirrored";
  }

  // The same email (same Message-ID) already handled through another connected mailbox.
  // Copies that mailbox only logged as ignored (e.g. its "sent" copy of a forward to us) don't count.
  if (email.messageIdHeader) {
    const { data: twin } = await db
      .from("inbound_emails")
      .select("mailbox")
      .eq("message_id_header", email.messageIdHeader)
      .neq("mailbox", deps.inbox)
      .neq("status", "ignored")
      .limit(1)
      .maybeSingle();
    if (twin) {
      await log(db, deps, email, "ignored", { ignore_reason: `also sent to ${twin.mailbox}; handled there` });
      return "duplicate";
    }
  }

  const client = await findClient(db, email.fromEmail, deps.program);
  const reason = ignoreReason(email, { knownClient: Boolean(client) });
  if (reason) {
    await log(db, deps, email, "ignored", { ignore_reason: reason });
    return "ignored";
  }

  // A reply in a thread that already carries a ticket.
  if (thread) {
    const { data: ticket } = await db.from("tickets").select("id, number, requester_id").eq("id", thread.ticket_id).single();
    if (ticket) {
      const authorId = client && client.id === ticket.requester_id ? client.id : null;
      const msg = await postTicketMessage(db, ticket.id, authorId, email, deps, email.fromName ?? email.fromEmail);
      if (email.messageIdHeader) {
        await db.from("mail_threads").update({ last_message_id_header: email.messageIdHeader }).eq("gmail_thread_id", email.gmailThreadId);
      }
      const inboundId = await log(db, deps, email, "appended", { ticket_id: ticket.id, hub_message_id: msg });
      await postCard(db, email, deps, { inbound_id: inboundId, kind: "reply", ticket_number: ticket.number });
      return "appended";
    }
  }

  // A client's new email → a new ticket.
  if (client) {
    const subject = ticketSubject(email.subject);
    const { data: ticket, error } = await db
      .from("tickets")
      .insert({ requester_id: client.id, program: client.program, category: "other", subject, source: "email" })
      .select("id, number")
      .single();
    if (error || !ticket) throw new Error(`Couldn't open a ticket for ${email.fromEmail}: ${error?.message}`);
    await db.from("mail_threads").insert({
      gmail_thread_id: email.gmailThreadId,
      ticket_id: ticket.id,
      subject: subject,
      last_message_id_header: email.messageIdHeader,
      mailbox: deps.inbox,
    });
    const msg = await postTicketMessage(db, ticket.id, client.id, email, deps, null);
    const inboundId = await log(db, deps, email, "ticket", { ticket_id: ticket.id, hub_message_id: msg });
    await postCard(db, email, deps, { inbound_id: inboundId, kind: "new_ticket", ticket_number: ticket.number });
    return "ticket";
  }

  // Someone who isn't a client (yet): a card for the team.
  const inboundId = await log(db, deps, email, "unmatched", {});
  await postCard(db, email, deps, { inbound_id: inboundId, kind: "unmatched" });
  return "unmatched";
}

/** A member with live access, matched by email. Program: the mailbox's if they have it. */
async function findClient(db: Db, address: string, mailboxProgram: Program | null): Promise<{ id: string; program: Program } | null> {
  const { data: profile } = await db.from("profiles").select("id, role").eq("email", address).maybeSingle();
  if (!profile || profile.role !== "member") return null;
  const { data: memberships } = await db.from("memberships").select("program, status, grace_until").eq("user_id", profile.id);
  const live = (memberships ?? []).filter((m) => membershipGrantsAccess(m)).map((m) => m.program);
  const program = ticketProgram(live, mailboxProgram);
  return program ? { id: profile.id, program } : null;
}

function ticketSubject(raw: string) {
  const s = cleanSubject(raw) || "Email to CoachOS";
  return (s.length < 3 ? `${s} (email)` : s).slice(0, 160);
}

async function postTicketMessage(
  db: Db,
  ticketId: string,
  authorId: string | null,
  email: ParsedEmail,
  deps: InboxDeps,
  senderLabel: string | null,
): Promise<string | null> {
  const attachments = await saveAttachments(db, `tickets/${ticketId}/${authorId ?? "email"}`, email, deps);
  const body = email.text || (attachments.length ? "" : "(This email had no text.)");
  const { data, error } = await db
    .from("messages")
    .insert({
      ticket_id: ticketId,
      author_id: authorId,
      kind: "user",
      via: "email",
      body,
      attachments: attachments as unknown as NonNullable<Json>,
      ...(senderLabel ? { meta: { sender: senderLabel, sender_email: email.fromEmail } as Json } : {}),
      created_at: email.receivedAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't add the email to the ticket: ${error.message}`);
  return data?.id ?? null;
}

async function saveAttachments(db: Db, folder: string, email: ParsedEmail, deps: InboxDeps) {
  if (!deps.fetchAttachment) return [];
  const saved: { path: string; name: string; size: number; type: string }[] = [];
  for (const ref of email.attachments) {
    if (ref.size > MAX_ATTACHMENT_BYTES) continue;
    const bytes = await deps.fetchAttachment(ref);
    const safe = ref.filename.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file";
    const path = `${folder}/${crypto.randomUUID()}-${safe}`;
    const { error } = await db.storage.from("attachments").upload(path, bytes, { contentType: ref.mimeType });
    if (!error) saved.push({ path, name: ref.filename, size: bytes.length, type: ref.mimeType });
  }
  return saved;
}

async function log(
  db: Db,
  deps: InboxDeps,
  email: ParsedEmail,
  status: "ticket" | "appended" | "unmatched" | "ignored" | "mirrored",
  extra: { ticket_id?: string | null; hub_message_id?: string | null; ignore_reason?: string | null },
): Promise<string> {
  const { data, error } = await db
    .from("inbound_emails")
    .insert({
      gmail_message_id: email.gmailMessageId,
      gmail_thread_id: email.gmailThreadId,
      message_id_header: email.messageIdHeader,
      from_email: email.fromEmail,
      from_name: email.fromName,
      subject: email.subject,
      body_text: email.text,
      received_at: email.receivedAt,
      mailbox: deps.inbox,
      status,
      ...extra,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Couldn't log the email: ${error?.message}`);
  return data.id;
}

async function postCard(
  db: Db,
  email: ParsedEmail,
  deps: InboxDeps,
  card: Pick<EmailCardMeta, "inbound_id" | "kind" | "ticket_number">,
) {
  if (!deps.feedChannelId) return;
  const meta: EmailCardMeta = {
    ...card,
    from_name: email.fromName,
    from_email: email.fromEmail,
    subject: email.subject || "(no subject)",
    preview: previewOf(email.text),
    attachments: email.attachments.length,
    gmail_url: gmailThreadUrl(email.gmailThreadId, deps.inbox),
  };
  const who = email.fromName ?? email.fromEmail;
  const summary =
    card.kind === "new_ticket"
      ? `New email from ${who} opened ticket #${card.ticket_number}: ${meta.subject}`
      : card.kind === "reply"
        ? `${who} replied by email on ticket #${card.ticket_number}`
        : `New email from ${who} (not a client yet): ${meta.subject}`;
  await db.from("messages").insert({
    channel_id: deps.feedChannelId,
    author_id: null,
    kind: "email",
    via: "email",
    body: summary,
    meta: meta as unknown as Json,
    created_at: email.receivedAt,
  });
}
