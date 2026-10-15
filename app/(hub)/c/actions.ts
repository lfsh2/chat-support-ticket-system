"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { membershipGrantsAccess, type Program } from "@/lib/access";
import { Constants } from "@/lib/database.types";
import { syncMailbox } from "@/lib/gmail/sync";
import { requireHubAccess } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { originFromHeaders } from "@/lib/url";

type Result = { ok: true } | { ok: false; error: string };

const ADMIN_ROLES = new Set(["admin", "owner"]);

/** "Casey Morgan's site" → "casey-morgan-s-site", matching how channel names read. */
function toChannelName(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function adminClient() {
  const { supabase, profile } = await requireHubAccess();
  return ADMIN_ROLES.has(profile.role) ? supabase : null;
}

/** Rename a client channel (admins). RLS limits channel writes to admins as well. */
export async function renameClientChannel(id: string, rawName: string): Promise<Result> {
  const name = toChannelName(rawName);
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Something went wrong." };
  if (name.length < 2) return { ok: false, error: "Use at least two letters or numbers." };
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can rename channels." };

  const { data, error } = await supabase
    .from("channels")
    .update({ name })
    .eq("id", id)
    .not("client_id", "is", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "That didn't save. Please try again." };
  refresh();
  return { ok: true };
}

/** Archive a client channel (admins): it disappears from the sidebar; messages are kept. */
export async function archiveClientChannel(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Something went wrong." };
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can archive channels." };

  const { data, error } = await supabase
    .from("channels")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .not("client_id", "is", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "We couldn't archive it. Please try again." };
  return { ok: true };
}

const STAFF_ROLES = new Set(["agent", "admin", "owner"]);

/** Staff: check the CoachOS mailbox now instead of waiting for the next minute. */
export async function syncMailNow(): Promise<Result & { summary?: string }> {
  const { profile } = await requireHubAccess();
  if (!STAFF_ROLES.has(profile.role)) return { ok: false, error: "Only the team can do that." };
  const report = await syncMailbox(createAdminClient(), originFromHeaders(await headers()));
  refresh();
  switch (report.status) {
    case "not_connected":
      return { ok: false, error: "The CoachOS mailbox isn't connected yet." };
    case "busy":
      return { ok: true, summary: "A check is already running. New mail will appear in a moment." };
    case "error":
      return { ok: false, error: `Gmail said: ${report.error}` };
    case "started":
      return { ok: true, summary: "Connected. New emails from now on will appear here." };
    case "ok": {
      const n = report.read;
      return { ok: true, summary: n === 0 ? "No new email." : `Checked ${n} new ${n === 1 ? "email" : "emails"}.` };
    }
  }
}

/** Staff: mark an email card (someone who isn't a client) as dealt with. */
export async function markEmailHandled(inboundId: string, messageId: string): Promise<Result> {
  if (!z.uuid().safeParse(inboundId).success || !z.uuid().safeParse(messageId).success) return { ok: false, error: "Something went wrong." };
  const { profile } = await requireHubAccess();
  if (!STAFF_ROLES.has(profile.role)) return { ok: false, error: "Only the team can do that." };
  const db = createAdminClient();

  const { data: msg } = await db.from("messages").select("meta, kind").eq("id", messageId).maybeSingle();
  if (!msg || msg.kind !== "email") return { ok: false, error: "That email card is gone." };
  const meta = { ...(msg.meta as Record<string, unknown>), handled_by: profile.display_name, handled_at: new Date().toISOString() };
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    db.from("inbound_emails").update({ status: "handled" }).eq("id", inboundId).eq("status", "unmatched"),
    db.from("messages").update({ meta }).eq("id", messageId),
  ]);
  if (e1 || e2) return { ok: false, error: "That didn't save. Please try again." };
  return { ok: true };
}

const fromChat = z.object({
  messageId: z.uuid(),
  subject: z
    .string()
    .trim()
    .min(3, "Add a short subject (at least 3 characters).")
    .max(160, "Keep the subject under 160 characters."),
  category: z.enum(Constants.public.Enums.ticket_category),
  priority: z.enum(Constants.public.Enums.ticket_priority),
  assignToMe: z.boolean(),
});
export type TicketFromChatInput = z.input<typeof fromChat>;

/**
 * Team: open a ticket for a client from a chat message (in their private channel, or a
 * client's own message anywhere). The message is copied in as the ticket's first message,
 * the chat message is marked with the ticket number, and the channel gets a short note.
 */
export async function createTicketFromMessage(input: TicketFromChatInput): Promise<Result & { number?: number }> {
  const parsed = fromChat.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { profile } = await requireHubAccess();
  if (!STAFF_ROLES.has(profile.role)) return { ok: false, error: "Only the team can create tickets from chat." };
  const { messageId, subject, category, priority, assignToMe } = parsed.data;
  const db = createAdminClient();

  const { data: msg } = await db
    .from("messages")
    .select(
      "id, channel_id, author_id, body, attachments, kind, deleted_at, meta, created_at, channel:channels!messages_channel_id_fkey(id, name, program, client_id), author:profiles!messages_author_id_fkey(id, role)",
    )
    .eq("id", messageId)
    .maybeSingle();
  const channel = msg?.channel as { id: string; name: string; program: Program | null; client_id: string | null } | null;
  const author = msg?.author as { id: string; role: string } | null;
  if (!msg || !channel || msg.kind !== "user" || msg.deleted_at) return { ok: false, error: "That message can't be turned into a ticket." };
  const existing = (msg.meta as { ticket?: { number: number } } | null)?.ticket;
  if (existing) return { ok: false, error: `This message is already ticket #${existing.number}.` };

  // Who the ticket is for: the channel's client, or the client who wrote it.
  const requesterId = channel.client_id ?? (author?.role === "member" ? author.id : null);
  if (!requesterId) return { ok: false, error: "Pick a client's message, or a message in their private channel." };
  const { data: memberships } = await db.from("memberships").select("program, status, grace_until").eq("user_id", requesterId);
  const live = (memberships ?? []).filter((m) => membershipGrantsAccess(m)).map((m) => m.program);
  if (live.length === 0) return { ok: false, error: "This client doesn't have an active program." };
  const program = channel.program && live.includes(channel.program) ? channel.program : live.includes("coachos") ? "coachos" : live[0];

  const { data: ticket, error } = await db
    .from("tickets")
    .insert({
      requester_id: requesterId,
      program,
      category,
      priority,
      subject,
      source: "chat",
      assignee_id: assignToMe ? profile.id : null,
      status: assignToMe ? "open" : "new",
    })
    .select("id, number")
    .single();
  if (error || !ticket) return { ok: false, error: "We couldn't open the ticket. Please try again." };

  // One insert each: a multi-row insert would null out the columns some rows leave to their defaults.
  const inserts = [
    db.from("messages").insert({
      ticket_id: ticket.id,
      author_id: msg.author_id,
      kind: "user",
      via: "chat",
      body: msg.body,
      attachments: msg.attachments,
      meta: { from_channel: channel.name, from_message_id: msg.id },
      created_at: msg.created_at,
    }),
    db.from("messages").insert({ ticket_id: ticket.id, author_id: profile.id, kind: "system", body: `opened this ticket from #${channel.name}` }),
  ];
  for (const { error: e } of await Promise.all(inserts)) {
    if (e) {
      await db.from("tickets").delete().eq("id", ticket.id); // don't leave an empty ticket behind
      return { ok: false, error: "We couldn't copy the message into the ticket. Please try again." };
    }
  }
  await db
    .from("messages")
    .insert({ channel_id: channel.id, author_id: profile.id, kind: "system", body: `opened ticket #${ticket.number} from a message here` });
  await db
    .from("messages")
    .update({
      meta: {
        ...((msg.meta as Record<string, unknown> | null) ?? {}),
        ticket: { id: ticket.id, number: ticket.number, requester_id: requesterId, by: profile.display_name },
      },
    })
    .eq("id", msg.id);

  refresh();
  return { ok: true, number: ticket.number };
}
