import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { syncMailbox } from "@/lib/gmail/sync";
import { createAdminClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * Called every minute by Supabase (pg_cron + pg_net, see supabase/mail-cron.sql) with
 * `Authorization: Bearer <CRON_SECRET>`: reads new CoachOS mail and sends queued replies.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse("Unauthorized", { status: 401 });

  const report = await syncMailbox(createAdminClient(), publicOrigin(request));
  return NextResponse.json(report, { status: report.status === "error" ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
