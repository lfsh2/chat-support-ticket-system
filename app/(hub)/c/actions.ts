"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { membershipGrantsAccess, type Program } from "@/lib/access";
import { ALWAYS_TEAM_ONLY_SLUGS, PROTECTED_CHANNEL_SLUGS, toChannelName } from "@/lib/channels";
import { Constants } from "@/lib/database.types";
import { syncMailboxes } from "@/lib/gmail/sync";
import { requireHubAccess } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { originFromHeaders } from "@/lib/url";

type Result = { ok: true } | { ok: false; error: string };

const ADMIN_ROLES = new Set(["admin", "owner"]);

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

const channelFields = z.object({
  name: z.string().max(80),
  description: z.string().trim().max(120, "Keep the description under 120 characters."),
  type: z.enum(Constants.public.Enums.channel_type),
  staffOnly: z.boolean(),
});
const newChannel = channelFields.extend({ program: z.enum(Constants.public.Enums.program).nullable() });
export type ChannelFields = z.input<typeof channelFields>;
export type NewChannelInput = z.input<typeof newChannel>;

/** Add a channel (admins): shared, CoachOS or Alive & Free; open to members or team-only. */
export async function createChannel(input: NewChannelInput): Promise<Result & { slug?: string }> {
  const parsed = newChannel.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const name = toChannelName(parsed.data.name);
  if (name.length < 2) return { ok: false, error: "Use at least two letters or numbers." };
  if (name.startsWith("client-")) return { ok: false, error: "Names starting with “client-” are kept for private client channels." };
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can add channels." };
  const { program, description, type, staffOnly } = parsed.data;

  // Admins can see every channel, archived ones included, so this catches all clashes.
  const { data: taken } = await supabase.from("channels").select("archived_at").eq("slug", name).maybeSingle();
  if (taken) {
    return {
      ok: false,
      error: taken.archived_at ? `An archived channel is already called #${name}. Pick another name.` : `There's already a #${name} channel.`,
    };
  }

  // New channels go to the bottom of their group.
  const last = supabase.from("channels").select("position").is("parent_id", null);
  const { data: bottom } = await (program ? last.eq("program", program) : last.is("program", null))
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("channels").insert({
    slug: name,
    name,
    description: description || null,
    program,
    type,
    staff_only: staffOnly,
    position: (bottom?.position ?? 0) + 1,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? `There's already a #${name} channel.` : "That didn't save. Please try again." };
  }
  refresh();
  return { ok: true, slug: name };
}

/**
 * Edit a channel's name, description, who can post and team-only (admins). The address
 * (slug) stays the same so links keep working; the program can't change, because that
 * would show its history to a different group of clients.
 */
export async function updateChannel(id: string, input: ChannelFields): Promise<Result> {
  const parsed = channelFields.safeParse(input);
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return { ok: false, error: parsed.success ? "Something went wrong." : parsed.error.issues[0].message };
  }
  const name = toChannelName(parsed.data.name);
  if (name.length < 2) return { ok: false, error: "Use at least two letters or numbers." };
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can edit channels." };

  const { data: channel } = await supabase.from("channels").select("slug, client_id").eq("id", id).maybeSingle();
  if (!channel || channel.client_id) return { ok: false, error: "That channel can't be edited here." };
  const { description, type, staffOnly } = parsed.data;

  const { error } = await supabase
    .from("channels")
    .update({
      name,
      description: description || null,
      type,
      staff_only: ALWAYS_TEAM_ONLY_SLUGS.has(channel.slug) ? true : staffOnly,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "That didn't save. Please try again." };
  refresh();
  return { ok: true };
}

/** Archive a channel (admins): hidden from the sidebar, messages kept. Core channels can't be archived. */
export async function archiveChannel(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Something went wrong." };
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Only admins can archive channels." };

  const { data: channel } = await supabase.from("channels").select("slug, client_id").eq("id", id).maybeSingle();
  if (!channel || channel.client_id) return { ok: false, error: "That channel can't be archived here." };
  if (PROTECTED_CHANNEL_SLUGS.has(channel.slug)) {
    return { ok: false, error: `#${channel.slug} is used by other parts of the hub, so it can't be archived.` };
  }
  const { error } = await supabase.from("channels").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "We couldn't archive it. Please try again." };
  return { ok: true };
}

const STAFF_ROLES = new Set(["agent", "admin", "owner"]);

/** Staff: check the mailbox feeding this channel now instead of waiting for the next minute. */
export async function syncMailNow(channelId: string): Promise<Result & { summary?: string }> {
  if (!z.uuid().safeParse(channelId).success) return { ok: false, error: "Something went wrong." };
  const { profile } = await requireHubAccess();
  if (!STAFF_ROLES.has(profile.role)) return { ok: false, error: "Only the team can do that." };
  const [report] = await syncMailboxes(createAdminClient(), originFromHeaders(await headers()), { channelId });
  refresh();
  if (!report) return { ok: false, error: "No mailbox is connected to this channel yet." };
  switch (report.status) {
    case "not_connected":
      return { ok: false, error: "No mailbox is connected to this channel yet." };
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
