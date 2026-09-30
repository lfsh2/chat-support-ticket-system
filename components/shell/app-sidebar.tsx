"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChannelNav } from "./channel-nav";
import { useHub } from "./hub-context";
import { UserAvatar } from "./user-avatar";
import { Wordmark } from "./wordmark";

export function AppSidebar() {
  const { profile } = useHub();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const close = () => setOpenMobile(false);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <Link href="/" onClick={close} className="flex h-10 items-center text-white">
          <Wordmark className="text-[20px]" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-2">
        <SidebarGroup className="pt-1 pb-3">
          {/* Deliberately not a big blue button: a quiet, always-there way in. */}
          <Link
            href="/help"
            onClick={close}
            className="group/help border-sidebar-foreground/15 hover:border-sidebar-foreground/40 focus-visible:ring-sidebar-ring flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors outline-none focus-visible:ring-2"
          >
            <span className="h-8 w-[3px] shrink-0 rounded-full bg-white" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white">Get help</span>
              <span className="text-sidebar-foreground/65 block text-xs">Stuck? Ask the team.</span>
            </span>
            <ArrowUpRight
              className="text-sidebar-foreground/50 size-4 transition-transform group-hover/help:translate-x-0.5 group-hover/help:-translate-y-0.5"
              aria-hidden
            />
          </Link>
        </SidebarGroup>
        <ChannelNav onNavigate={close} tabbed={!isMobile} />
      </SidebarContent>

      <SidebarFooter className="border-sidebar-foreground/10 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Link
          href="/me"
          onClick={close}
          className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors outline-none focus-visible:ring-2"
        >
          <UserAvatar name={profile.display_name} src={profile.avatar_url} seed={profile.id} className="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{profile.display_name}</span>
            <span className="text-sidebar-foreground/60 block truncate text-xs">Profile and settings</span>
          </span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
