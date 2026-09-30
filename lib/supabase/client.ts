import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEMO_OFFLINE } from "@/lib/demo/config";
import { createBrowserDemoClient } from "@/lib/demo/browser";

export function createClient(): SupabaseClient<Database> {
  // Offline demo: same interface, backed by the server's in-memory sample data.
  if (DEMO_OFFLINE) return createBrowserDemoClient() as unknown as SupabaseClient<Database>;
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
