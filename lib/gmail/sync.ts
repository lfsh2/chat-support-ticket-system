import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { decryptSecret } from "@/lib/crypto";
import { processInboundEmail, type InboundOutcome } from "@/lib/email/inbox";
import { flushOutbox } from "@/lib/email/outbox";
import { parseGmailMessage } from "@/lib/email/parse";
import { Gmail, GmailError, accessTokenFrom } from "./client";

type Db = SupabaseClient<Database>;

export type SyncReport =
  | { status: "not_connected" }
  | { status: "busy" }
  | { status: "started"; historyId: string }
  | { status: "ok"; read: number; outcomes: Partial<Record<InboundOutcome, number>>; sent: number }
  | { status: "error"; error: string };

/**
 * One pass: read what's new in the CoachOS mailbox since the last pass, turn it into
 * tickets / feed cards, then send any queued replies. Run every minute by Supabase cron
 * (POST /api/cron/mail) and on demand from "Sync now".
 */
export async function syncMailbox(db: Db, appUrl: string): Promise<SyncReport> {
  const { data: latest } = await db.from("mail_connections").select("id").order("connected_at", { ascending: false }).limit(1).maybeSingle();
  if (!latest) return { status: "not_connected" };

  // Claim the mailbox so a cron tick and "Sync now" can't process the same mail twice.
  // A claim older than 5 minutes is a crashed run and may be taken over.
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: conn } = await db
    .from("mail_connections")
    .update({ sync_started_at: new Date().toISOString() })
    .eq("id", latest.id)
    .or(`sync_started_at.is.null,sync_started_at.lt.${staleBefore}`)
    .select("*")
    .maybeSingle();
  if (!conn) return { status: "busy" };

  try {
    const gmail = new Gmail(await accessTokenFrom(decryptSecret(conn.refresh_token_enc)));

    // First pass after connecting: start from "now" rather than importing the whole inbox.
    if (!conn.history_id) {
      const { historyId } = await gmail.profile();
      await db.from("mail_connections").update({ history_id: historyId, last_synced_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
      return { status: "started", historyId };
    }

    let added: { ids: string[]; latest: string };
    try {
      added = await gmail.addedSince(conn.history_id);
    } catch (err) {
      // Gmail keeps about a week of history; if we fell behind, restart from now.
      if (err instanceof GmailError && err.status === 404) {
        const { historyId } = await gmail.profile();
        await db
          .from("mail_connections")
          .update({ history_id: historyId, last_error: "Sync history expired; restarted from now." })
          .eq("id", conn.id);
        return { status: "started", historyId };
      }
      throw err;
    }

    const outcomes: Partial<Record<InboundOutcome, number>> = {};
    for (const id of added.ids) {
      let msg;
      try {
        msg = await gmail.message(id);
      } catch (err) {
        if (err instanceof GmailError && err.status === 404) continue; // deleted before we got to it
        throw err;
      }
      const email = parseGmailMessage(msg);
      const outcome = await processInboundEmail(db, email, {
        inbox: conn.email,
        fetchAttachment: (ref) => gmail.attachment(id, ref.attachmentId),
      });
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    }

    const { sent } = await flushOutbox(db, { send: (raw, threadId) => gmail.send(raw, threadId) }, { inbox: conn.email, appUrl });

    await db
      .from("mail_connections")
      .update({ history_id: added.latest, last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", conn.id);
    return { status: "ok", read: added.ids.length, outcomes, sent };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.from("mail_connections").update({ last_error: error.slice(0, 500) }).eq("id", conn.id);
    return { status: "error", error };
  } finally {
    await db.from("mail_connections").update({ sync_started_at: null }).eq("id", conn.id);
  }
}
