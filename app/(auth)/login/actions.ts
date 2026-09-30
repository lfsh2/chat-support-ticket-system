"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_OFFLINE } from "@/lib/demo/config";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { canSignIn, normalizeEmail } from "@/lib/access";
import { SUPPORT_EMAIL } from "@/lib/config";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email?: string };

const schema = z.object({
  email: z.email("That doesn't look like an email address. Check for typos and try again."),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message, email: String(formData.get("email") ?? "") };
  }

  const email = normalizeEmail(parsed.data.email);
  const admin = createAdminClient();

  const [{ data: memberships, error: mErr }, { data: profile, error: pErr }] = await Promise.all([
    admin.from("memberships").select("status, grace_until, program").eq("email", email),
    admin.from("profiles").select("id, role").eq("email", email).maybeSingle(),
  ]);
  if (mErr || pErr) {
    return { status: "error", message: "We couldn't check your membership just now. Please try again in a minute.", email };
  }

  if (!canSignIn(memberships ?? [], profile?.role)) {
    return {
      status: "error",
      email,
      message: `We couldn't find an active membership for this email. Use the email you paid with, or contact ${SUPPORT_EMAIL}.`,
    };
  }

  // Offline demo: no email to send — sign straight in as that test member.
  if (DEMO_OFFLINE && profile) {
    const { setDemoUser } = await import("@/lib/demo/server");
    await setDemoUser(profile.id);
    redirect(safeNext(parsed.data.next));
  }

  // Open sign-up is off in Supabase, so first-time members get an account created here.
  if (!profile) {
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error && !/already/i.test(error.message)) {
      return { status: "error", message: "We couldn't set up your account. Please try again.", email };
    }
  }

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const next = safeNext(parsed.data.next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}${next}`,
    },
  });
  if (error) {
    console.warn("signInWithOtp failed:", error.status, error.code, error.message);
    const message = error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)
      ? "We just sent you a link. Please wait a minute before asking for another."
      : "We couldn't send your sign-in link. Please try again.";
    return { status: "error", message, email };
  }

  return { status: "sent", email };
}
