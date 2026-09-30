import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Deployment check. Reports which settings are present (never their values) and whether
 * the database answers, so a blank "Internal Server Error" can be traced quickly.
 */
export async function GET() {
  const env = {
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    DEMO_LOGIN_KEY: (process.env.DEMO_LOGIN_KEY ?? "").length >= 16,
    DEMO_MODE: process.env.DEMO_MODE === "true",
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseIsLocal = /127\.0\.0\.1|localhost/.test(url);

  let database: string;
  let channels: number | null = null;
  let testUsers: number | null = null;
  try {
    const admin = createAdminClient();
    const [c, u] = await Promise.all([
      admin.from("channels").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }).like("email", "%@example.com"),
    ]);
    if (c.error) throw c.error;
    database = "ok";
    channels = c.count;
    testUsers = u.count;
  } catch (err) {
    database = `error: ${err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err)}`;
  }

  const ok = Object.entries(env).every(([k, v]) => v || k.startsWith("DEMO_")) && !supabaseIsLocal && database === "ok";
  return NextResponse.json(
    {
      ok,
      env,
      supabaseIsLocal,
      database,
      channels,
      testUsers,
      hint: supabaseIsLocal
        ? "NEXT_PUBLIC_SUPABASE_URL points at your laptop (127.0.0.1). Use your hosted Supabase project URL."
        : undefined,
    },
    { status: ok ? 200 : 503 },
  );
}
