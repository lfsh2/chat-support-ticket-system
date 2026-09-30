import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/empty-state";
import { TopBar } from "@/components/shell/top-bar";

export default function ChannelNotFound() {
  return (
    <>
      <TopBar title="Channel not found" />
      <EmptyState
        eyebrow="Hmm"
        title="We can't find that channel."
        action={
          <Button
            nativeButton={false}
            render={<Link href="/c/general" />}
            className="bg-ink text-background hover:bg-ink/90 h-11 cursor-pointer px-5 font-semibold"
          >
            Go to #general
          </Button>
        }
      >
        It may have been renamed, or it isn&apos;t part of your membership.
      </EmptyState>
    </>
  );
}
