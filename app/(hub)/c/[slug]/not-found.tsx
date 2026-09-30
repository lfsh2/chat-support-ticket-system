import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/shell/top-bar";

export default function ChannelNotFound() {
  return (
    <>
      <TopBar title="Channel not found" />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-[15px]">This channel doesn&apos;t exist, or it isn&apos;t part of your membership.</p>
        <Button nativeButton={false} render={<Link href="/c/general" />} className="h-11 px-4">
          Go to #general
        </Button>
      </div>
    </>
  );
}
