import { MessagesSquare } from "lucide-react";
import { TopBar } from "@/components/shell/top-bar";
import { MobileChannelList } from "./mobile-channel-list";

// Chat tab with no channel open: the channel list on mobile, a gentle prompt on desktop.
export default function ChannelsIndex() {
  return (
    <>
      <TopBar title="Chat" showMenu={false} className="md:hidden" />
      <MobileChannelList />
      <div className="text-muted-foreground hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center md:flex">
        <MessagesSquare className="size-10 opacity-50" aria-hidden />
        <p className="text-[15px]">Pick a channel on the left to start chatting.</p>
      </div>
    </>
  );
}
