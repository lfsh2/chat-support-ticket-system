import type { Metadata } from "next";
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
        eyebrow="Your tickets"
        title="No open tickets."
        action={
          <Button
            nativeButton={false}
            render={<a href={`mailto:${SUPPORT_EMAIL}`} />}
            className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold"
          >
            Get help
          </Button>
        }
      >
        Stuck on something? Tell us what&apos;s going on and we&apos;ll take it from there. We usually reply within one
        business day.
      </EmptyState>
    </>
  );
}
