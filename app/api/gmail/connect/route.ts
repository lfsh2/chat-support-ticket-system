import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, consentUrl, gmailConfigured } from "@/lib/gmail/client";
import { requireHubAccess } from "@/lib/session";
import { publicOrigin } from "@/lib/url";

/** Admins only: send them to Google to authorise the CoachOS mailbox. */
export async function GET(request: NextRequest) {
  const { profile } = await requireHubAccess();
  const origin = publicOrigin(request);
  if (profile.role !== "admin" && profile.role !== "owner") return new NextResponse("Only admins can connect the mailbox.", { status: 403 });
  if (!gmailConfigured()) return NextResponse.redirect(`${origin}/c/coachos-email-ticket?gmail=not_configured`);

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(consentUrl(state, `${origin}/api/gmail/callback`));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 600,
  });
  return res;
}
