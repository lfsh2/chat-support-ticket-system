import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { encryptSecret } from "@/lib/crypto";
import { Gmail, STATE_COOKIE, exchangeCode } from "@/lib/gmail/client";
import { syncMailboxes } from "@/lib/gmail/sync";
import { createAdminClient } from "@/lib/supabase/server";
import { requireHubAccess } from "@/lib/session";
import { publicOrigin } from "@/lib/url";

/**
 * Google sends the admin back here: store the (encrypted) refresh token for the mailbox they
 * signed in as, feeding the team-only channel they started from.
 */
export async function GET(request: NextRequest) {
  const { profile } = await requireHubAccess();
  const origin = publicOrigin(request);
  const db = createAdminClient();
  let slug: string | null = null;
  const back = (result: string, extra = "") => {
    const res = NextResponse.redirect(`${origin}/c${slug ? `/${slug}` : ""}?gmail=${result}${extra}`);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/gmail" });
    return res;
  };
  if (profile.role !== "admin" && profile.role !== "owner") return back("forbidden");

  const { searchParams } = request.nextUrl;
  const state = searchParams.get("state") ?? "";
  const expected = request.cookies.get(STATE_COOKIE)?.value ?? "";
  const stateOk = state.length > 0 && state.length === expected.length && timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!stateOk) return back("expired");

  const channelId = state.split(".")[1] ?? "";
  if (!z.uuid().safeParse(channelId).success) return back("expired");
  const { data: channel } = await db
    .from("channels")
    .select("id, slug, program, staff_only, client_id, archived_at")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return back("expired");
  slug = channel.slug;
  if (!channel.staff_only || channel.client_id || channel.archived_at) return back("not_team_only");
  if (searchParams.get("error")) return back("cancelled");

  try {
    const { accessToken, refreshToken } = await exchangeCode(searchParams.get("code") ?? "", `${origin}/api/gmail/callback`);
    const email = (await new Gmail(accessToken).profile()).emailAddress.toLowerCase();

    // One mailbox per channel, one channel per mailbox.
    const { data: existing } = await db.from("mail_connections").select("channel_id").eq("email", email).maybeSingle();
    if (existing?.channel_id && existing.channel_id !== channel.id) {
      const { data: other } = await db.from("channels").select("slug").eq("id", existing.channel_id).maybeSingle();
      return back("in_use", other ? `&in=${encodeURIComponent(other.slug)}` : "");
    }
    // Switching this channel to a different account: the old connection goes.
    await db.from("mail_connections").delete().eq("channel_id", channel.id).neq("email", email);

    const { error } = await db.from("mail_connections").upsert(
      {
        email,
        channel_id: channel.id,
        program: channel.program,
        refresh_token_enc: encryptSecret(refreshToken),
        connected_by: profile.id,
        connected_at: new Date().toISOString(),
        history_id: null, // start from "now"
        last_error: null,
        sync_started_at: null,
      },
      { onConflict: "email" },
    );
    if (error) throw new Error(error.message);
    await syncMailboxes(db, origin, { channelId: channel.id });
    return back("connected");
  } catch (err) {
    console.error("Gmail connect failed:", err instanceof Error ? err.message : err);
    return back("error");
  }
}
