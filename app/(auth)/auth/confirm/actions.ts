"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { originFromHeaders } from "@/lib/url";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/**
 * The actual sign-in, run only when a person presses "Continue". Link previews and email
 * scanners fetch links (GET) but never submit forms, so they can't use up the one-time token.
 */
export async function confirmSignIn(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const rawType = String(formData.get("type") ?? "email") as EmailOtpType;
  const type = OTP_TYPES.includes(rawType) ? rawType : "email";
  const origin = originFromHeaders(await headers());

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) redirect(resolveNext(String(formData.get("next") ?? ""), origin));
  }
  redirect("/login?error=link");
}

// `next` arrives as the full redirect URL from the email template; keep only same-origin paths.
function resolveNext(next: string, origin: string): string {
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
