import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { Gmail, INBOX_ADDRESS, STATE_COOKIE, exchangeCode } from "@/lib/gmail/client";
import { syncMailbox } from "@/lib/gmail/sync";
import { createAdminClient } from "@/lib/supabase/server";
import { requireHubAccess } from "@/lib/session";
import { publicOrigin } from "@/lib/url";

/** Google sends the admin back here; store the (encrypted) refresh token for the CoachOS mailbox. */
export async function GET(request: NextRequest) {
  const { profile } = await requireHubAccess();
  const origin = publicOrigin(request);
  const back = (result: string) => {
    const res = NextResponse.redirect(`${origin}/c/coachos-email-ticket?gmail=${result}`);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/gmail" });
    return res;
  };
  if (profile.role !== "admin" && profile.role !== "owner") return back("forbidden");

  const { searchParams } = request.nextUrl;
  const state = searchParams.get("state") ?? "";
  const expected = request.cookies.get(STATE_COOKIE)?.value ?? "";
  const stateOk = state.length > 0 && state.length === expected.length && timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!stateOk) return back("expired");
  if (searchParams.get("error")) return back("cancelled");

  try {
    const { accessToken, refreshToken } = await exchangeCode(searchParams.get("code") ?? "", `${origin}/api/gmail/callback`);
    const { emailAddress } = await new Gmail(accessToken).profile();
    if (emailAddress.toLowerCase() !== INBOX_ADDRESS) return back("wrong_account");

    const db = createAdminClient();
    const { error } = await db.from("mail_connections").upsert(
      {
        email: INBOX_ADDRESS,
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
    await syncMailbox(db, origin);
    return back("connected");
  } catch (err) {
    console.error("Gmail connect failed:", err instanceof Error ? err.message : err);
    return back("error");
  }
}
