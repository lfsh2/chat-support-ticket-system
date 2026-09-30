import type { Metadata } from "next";
import { EmptyState } from "@/components/shell/empty-state";
import { TopBar } from "@/components/shell/top-bar";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Inbox · ${APP_NAME}` };

// Phase 3 fills this with mentions, thread replies and ticket updates.
export default function InboxPage() {
  return (
    <>
      <TopBar title="Inbox" />
      <EmptyState eyebrow="Mentions and replies" title="You're all caught up.">
        When someone mentions you, replies to you, or updates one of your tickets, it&apos;ll land here.
      </EmptyState>
    </>
  );
}
