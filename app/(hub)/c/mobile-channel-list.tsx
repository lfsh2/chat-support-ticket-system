"use client";

import { ChannelNav } from "@/components/shell/channel-nav";

// Same nav as the sidebar, re-inked for the paper page.
export function MobileChannelList() {
  return (
    <div data-sidebar="sidebar" className="on-paper flex-1 overflow-y-auto px-2 py-3 md:hidden">
      <ChannelNav />
    </div>
  );
}
