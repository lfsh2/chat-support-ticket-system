import { EmptyState } from "@/components/shell/empty-state";
import { TopBar } from "@/components/shell/top-bar";
import { MobileChannelList } from "./mobile-channel-list";

// Chat tab with no channel open: the channel list on mobile, a gentle prompt on desktop.
export default function ChannelsIndex() {
  return (
    <>
      <TopBar title="Channels" showMenu={false} className="md:hidden" />
      <MobileChannelList />
      <div className="hidden flex-1 md:flex">
        <EmptyState eyebrow="Chat" title="Pick a channel to start.">
          Channels are grouped by program on the left. Everyone can see the ones at the top.
        </EmptyState>
      </div>
    </>
  );
}
