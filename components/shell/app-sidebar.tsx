"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_NAME } from "@/lib/config";
import { ChannelNav } from "./channel-nav";
import { useHub } from "./hub-context";
import { UserAvatar } from "./user-avatar";

export function AppSidebar() {
  const { profile } = useHub();
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" onClick={close} className="flex h-10 items-center gap-2 font-semibold text-white">
          <span className="bg-primary flex size-7 items-center justify-center rounded-lg text-xs font-bold">
            {APP_NAME.slice(0, 1)}
          </span>
          {APP_NAME}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/help" onClick={close} />}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground h-11 justify-center font-semibold md:h-9"
              >
                <LifeBuoy aria-hidden />
                Get help
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <ChannelNav onNavigate={close} />
      </SidebarContent>
      <SidebarFooter className="pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/me" onClick={close} />} className="h-12">
              <UserAvatar name={profile.display_name} src={profile.avatar_url} seed={profile.id} className="size-8" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-white">{profile.display_name}</span>
                <span className="block truncate text-xs opacity-70">Profile & settings</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
