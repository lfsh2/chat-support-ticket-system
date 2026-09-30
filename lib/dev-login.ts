import "server-only";

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

export const DEV_USERS = [
  { email: "coachos@example.com", label: "Casey", note: "CoachOS member" },
  { email: "alivefree@example.com", label: "Alex", note: "Alive & Free member" },
  { email: "both@example.com", label: "Bailey", note: "Both programs" },
  { email: "agent@example.com", label: "Jon", note: "Support agent" },
  { email: "owner@example.com", label: "Sammi", note: "Owner" },
  { email: "lapsed@example.com", label: "Lee", note: "Lapsed (sees access-ended)" },
] as const;
