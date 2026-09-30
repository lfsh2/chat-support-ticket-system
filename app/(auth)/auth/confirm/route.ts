import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Uses token_hash (not PKCE) so the link works even when
 * the mail app opens it in a different browser than the one that requested it.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${resolveNext(searchParams.get("next"), origin)}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}

// `next` arrives as the full redirect URL from the email template; keep only same-origin paths.
function resolveNext(next: string | null, origin: string): string {
  if (!next) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    const inner = url.pathname.startsWith("/auth/") ? url.searchParams.get("next") : null;
    const path = inner ?? `${url.pathname}${url.search}`;
    return path.startsWith("/") && !path.startsWith("//") ? path : "/";
  } catch {
    return "/";
  }
}
