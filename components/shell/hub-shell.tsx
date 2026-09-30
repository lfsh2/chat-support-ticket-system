"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { AppSidebar } from "./app-sidebar";
import { BottomTabs } from "./bottom-tabs";
import { HubProvider, type HubChannel, type HubProfile, type UnreadCounts } from "./hub-context";

export function HubShell({
  profile,
  channels,
  initialUnread,
  children,
}: {
  profile: HubProfile;
  channels: HubChannel[];
  initialUnread: UnreadCounts;
  children: React.ReactNode;
}) {
  useKeyboardInset();
  return (
    <HubProvider profile={profile} channels={channels} initialUnread={initialUnread}>
      {/* Pinned to the visual viewport so the composer rides above the keyboard. */}
      <div className="fixed inset-x-0 top-(--app-top,0px) h-(--app-height,100dvh) overflow-hidden">
        <SidebarProvider className="h-full min-h-0">
          <AppSidebar />
          <SidebarInset className="paper flex h-full min-h-0 min-w-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            <BottomTabs />
          </SidebarInset>
        </SidebarProvider>
      </div>
    </HubProvider>
  );
}
