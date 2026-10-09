import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

export const E2E_TAG = "[e2e]";

/** Removes tickets and tasks created by e2e runs (tagged "[e2e]"), so reruns don't trip rate limits. Local only. */
export async function cleanupE2eData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { data: tickets } = await admin.from("tickets").select("id").like("subject", `${E2E_TAG}%`);
  const ids = (tickets ?? []).map((t) => t.id);
  await admin.from("tasks").delete().like("title", `${E2E_TAG}%`);
  if (ids.length) {
    await admin.from("messages").delete().in("ticket_id", ids);
    await admin.from("tickets").delete().in("id", ids);
  }
}
