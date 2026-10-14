"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireHubAccess } from "@/lib/session";

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
