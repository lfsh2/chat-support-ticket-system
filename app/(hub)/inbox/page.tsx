import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { TopBar } from "@/components/shell/top-bar";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Inbox · ${APP_NAME}` };

// Phase 3 fills this with mentions, thread replies and ticket updates.
export default function InboxPage() {
  return (
    <>
      <TopBar title="Inbox" />
      <EmptyState icon={Bell} title="You're all caught up">
        When someone mentions you or replies to you, it&apos;ll show up here.
      </EmptyState>
    </>
  );
}
