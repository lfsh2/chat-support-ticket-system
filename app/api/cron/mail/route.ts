import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { syncMailboxes } from "@/lib/gmail/sync";
import { createAdminClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Called every minute by Supabase (pg_cron + pg_net, see supabase/mail-cron.sql) with
 * `Authorization: Bearer <CRON_SECRET>`: reads new mail in every connected mailbox and sends queued replies.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse("Unauthorized", { status: 401 });

  const reports = await syncMailboxes(createAdminClient(), publicOrigin(request));
  const allFailed = reports.length > 0 && reports.every((r) => r.status === "error");
  return NextResponse.json({ status: reports.length ? "ok" : "not_connected", mailboxes: reports }, { status: allFailed ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
