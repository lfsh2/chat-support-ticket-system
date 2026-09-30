/**
 * Offline demo: the whole hub runs on in-memory sample data — no Supabase needed.
 * NEXT_PUBLIC_ so the browser knows too. Everything resets when the server restarts.
 */
export const DEMO_OFFLINE = process.env.NEXT_PUBLIC_DEMO_OFFLINE === "true";
export const DEMO_COOKIE = "hub_demo_user";
