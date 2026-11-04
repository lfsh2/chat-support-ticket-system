import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { EMAIL_FEED_SLUG } from "@/lib/email/card";
import { INBOX_ADDRESS, STATE_COOKIE, consentUrl, gmailConfigured } from "@/lib/gmail/client";
import { requireHubAccess } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/url";

/**
 * Admins only: send them to Google to connect a mailbox to a team-only channel
 * (?channel=<id>; without it, #coachos-email-ticket, as older links expect).
 */
export async function GET(request: NextRequest) {
  const { profile } = await requireHubAccess();
  const origin = publicOrigin(request);
  if (profile.role !== "admin" && profile.role !== "owner") return new NextResponse("Only admins can connect a mailbox.", { status: 403 });

  const db = createAdminClient();
  const requested = request.nextUrl.searchParams.get("channel");
  const lookup = db.from("channels").select("id, slug, staff_only, client_id, archived_at");
  const { data: channel } = await (z.uuid().safeParse(requested).success
    ? lookup.eq("id", requested!)
    : lookup.eq("slug", EMAIL_FEED_SLUG)
  ).maybeSingle();
  if (!channel || !channel.staff_only || channel.client_id || channel.archived_at) {
    return NextResponse.redirect(`${origin}/c${channel ? `/${channel.slug}` : ""}?gmail=not_team_only`);
  }
  if (!gmailConfigured()) return NextResponse.redirect(`${origin}/c/${channel.slug}?gmail=not_configured`);

  // Reconnecting suggests the account already connected here.
  const { data: current } = await db.from("mail_connections").select("email").eq("channel_id", channel.id).maybeSingle();
  const hint = current?.email ?? (channel.slug === EMAIL_FEED_SLUG ? INBOX_ADDRESS : null);

  // The channel rides along in the (signed-by-cookie) state, so the callback knows where it goes.
  const state = `${randomBytes(24).toString("base64url")}.${channel.id}`;
  const res = NextResponse.redirect(consentUrl(state, `${origin}/api/gmail/callback`, hint));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 600,
  });
  return res;
}
