import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/empty-state";
import { TopBar } from "@/components/shell/top-bar";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: `Help · ${APP_NAME}` };

// Phase 4 replaces this with tickets + the "Get help" flow.
export default function HelpPage() {
  return (
    <>
      <TopBar title="Help" />
      <EmptyState
        icon={LifeBuoy}
        title="No open tickets"
        action={
          <Button nativeButton={false} render={<a href={`mailto:${SUPPORT_EMAIL}`} />} className="h-11 px-5">
            Get help
          </Button>
        }
      >
        Stuck on something? Send us a note and we&apos;ll get back to you. We usually reply within one business day.
      </EmptyState>
    </>
  );
}
