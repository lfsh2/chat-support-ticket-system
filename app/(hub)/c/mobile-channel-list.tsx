"use client";

import { ChannelNav } from "@/components/shell/channel-nav";

export function MobileChannelList() {
  return (
    <div data-sidebar="sidebar" className="bg-sidebar text-sidebar-foreground flex-1 overflow-y-auto px-2 py-2 md:hidden">
      <ChannelNav />
    </div>
  );
}
