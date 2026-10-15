"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
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
