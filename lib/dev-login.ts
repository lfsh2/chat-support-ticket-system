import "server-only";
import { timingSafeEqual } from "node:crypto";
import { DEMO_OFFLINE } from "@/lib/demo/config";

/**
 * One-click sign-in for local development. Every condition must hold, so it can never
 * switch on in a deployed app: dev server, local Supabase, and an explicit opt-in flag.
 */
export function devLoginEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_LOGIN === "true" &&
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)
  );
}

/**
 * Demo mode for showing the hub on a live URL: set DEMO_LOGIN_KEY (16+ random chars) on the
 * server and share links carrying ?key=… Only the seeded @example.com users can be used, so it
 * never grants access to a real client's account. Unset the variable to turn it off.
 */
export function demoKeyValid(key: string | null | undefined): boolean {
  const expected = process.env.DEMO_LOGIN_KEY ?? "";
  if (expected.length < 16 || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Open demo: DEMO_MODE=true shows the "sign in as a test user" panel to everyone on /login.
 * For a demo deployment only — anyone with the URL can get in as a test user. Turn it off
 * (unset the variable) before real clients are invited.
 */
export function publicDemoEnabled(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function canUseDevLogin(key?: string | null): boolean {
  return devLoginEnabled() || publicDemoEnabled() || DEMO_OFFLINE || demoKeyValid(key);
}

export const DEV_USERS = [
  { slug: "coachos", email: "coachos@example.com", label: "Casey", note: "CoachOS member" },
  { slug: "alivefree", email: "alivefree@example.com", label: "Alex", note: "Alive & Free member" },
  { slug: "both", email: "both@example.com", label: "Bailey", note: "Both programs" },
  { slug: "agent", email: "agent@example.com", label: "Jon", note: "Support agent" },
  { slug: "owner", email: "owner@example.com", label: "Sammi", note: "Owner" },
  { slug: "lapsed", email: "lapsed@example.com", label: "Lee", note: "Lapsed (sees access-ended)" },
] as const;

/** Signs the current request in as a seeded user by minting and verifying a magic-link token. */
export async function signInAsDevUser(email: string, key?: string | null) {
  if (!canUseDevLogin(key)) throw new Error("Dev login is disabled.");
  if (!DEV_USERS.some((u) => u.email === email)) throw new Error("Not a seeded dev user.");

  if (DEMO_OFFLINE) {
    const { demoUserByEmail } = await import("@/lib/demo/store");
    const { setDemoUser } = await import("@/lib/demo/server");
    const user = demoUserByEmail(email);
    if (!user) throw new Error("Demo user not found.");
    await setDemoUser(user.id);
    return;
  }

  const { createAdminClient, createClient } = await import("@/lib/supabase/server");
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? "Couldn't create a dev link.");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw new Error(verifyError.message);
}
