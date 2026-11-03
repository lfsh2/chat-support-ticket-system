import type { Metadata } from "next";
import { InboxList } from "@/components/inbox/inbox-list";
import { TopBar } from "@/components/shell/top-bar";
import { APP_NAME } from "@/lib/config";
import { INBOX_LIMIT, INBOX_SELECT, visibleItems, type InboxItem } from "@/lib/inbox";
import { requireHubAccess } from "@/lib/session";

export const metadata: Metadata = { title: `Inbox · ${APP_NAME}` };

/** Mentions, replies to your threads, and ticket updates, newest first. */
export default async function InboxPage() {
  const { supabase } = await requireHubAccess();
  const { data } = await supabase
    .from("notifications")
    .select(INBOX_SELECT)
    .order("created_at", { ascending: false })
    .limit(INBOX_LIMIT);

  return (
    <>
      <TopBar title="Inbox" />
      <InboxList initialItems={visibleItems((data ?? []) as unknown as InboxItem[])} />
    </>
  );
}
