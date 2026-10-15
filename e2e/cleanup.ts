import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

export const E2E_TAG = "[e2e]";

/** Removes tickets and tasks created by e2e runs (tagged "[e2e]"), so reruns don't trip rate limits. Local only. */
export async function cleanupE2eData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Refusing to clean up non-local Supabase: ${url}`);
  const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { data: tickets } = await admin.from("tickets").select("id").like("subject", `${E2E_TAG}%`);
  const ids = (tickets ?? []).map((t) => t.id);
  await admin.from("tasks").delete().like("title", `${E2E_TAG}%`);
  if (ids.length) {
    await admin.from("email_outbox").delete().in("ticket_id", ids);
    await admin.from("messages").delete().in("ticket_id", ids);
    await admin.from("tickets").delete().in("id", ids);
  }
  // Email feed cards and the inbound log for test emails.
  await admin.from("messages").delete().eq("kind", "email").like("meta->>subject", `%${E2E_TAG}%`);
  await admin.from("inbound_emails").delete().like("subject", `%${E2E_TAG}%`);
}

const PLACEHOLDER_TOKEN = "e2e-placeholder";

/** Pretend the CoachOS mailbox is connected (replies only queue for email while it is). Leaves a real local connection alone. */
export async function fakeMailbox(on: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
  if (on) {
    const { data } = await admin.from("mail_connections").select("id").limit(1);
    if (!data?.length) await admin.from("mail_connections").insert({ email: "coachos@aliveandfreeconsulting.com", refresh_token_enc: PLACEHOLDER_TOKEN });
  } else {
    await admin.from("mail_connections").delete().eq("refresh_token_enc", PLACEHOLDER_TOKEN);
  }
}
