"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Hash, Megaphone } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PROGRAMS } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useHub, type HubChannel } from "./hub-context";

const GROUPS: { key: HubChannel["program"]; label: string; accent?: string }[] = [
  { key: null, label: "Shared" },
  { key: "coachos", label: PROGRAMS.coachos.label, accent: PROGRAMS.coachos.accent },
  { key: "alive_free", label: PROGRAMS.alive_free.label, accent: PROGRAMS.alive_free.accent },
];

export function formatCount(n: number) {
  return n > 99 ? "99+" : String(n);
}

/** Channel groups for the sidebar (desktop) and the mobile channel sheet/list. */
export function ChannelNav({ onNavigate }: { onNavigate?: () => void }) {
  const { channels, unread } = useHub();
  const pathname = usePathname();

  return (
    <>
      {GROUPS.map((group) => {
        const list = channels.filter((c) => c.program === group.key);
        if (list.length === 0) return null;
        return (
          <Collapsible key={group.label} defaultOpen render={<SidebarGroup />}>
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className="group/label text-sidebar-foreground/70 hover:text-sidebar-foreground h-9 cursor-pointer gap-2 text-xs font-semibold tracking-wide uppercase"
            >
              {group.accent && <span className="size-2 rounded-full" style={{ background: group.accent }} aria-hidden />}
              {group.label}
              <ChevronDown className="ml-auto size-4 transition-transform group-data-[panel-open]/label:rotate-0 group-not-data-[panel-open]/label:-rotate-90" aria-hidden />
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {list.map((c) => {
                    const href = `/c/${c.slug}`;
                    const count = unread[c.id] ?? 0;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    const Icon = c.type === "announcement" ? Megaphone : Hash;
                    return (
                      <SidebarMenuItem key={c.id}>
                        <SidebarMenuButton
                          isActive={active}
                          render={<Link href={href} onClick={onNavigate} />}
                          className={cn(
                            "h-11 text-[15px] md:h-8 md:text-sm",
                            count > 0 && !active && "text-sidebar-accent-foreground font-semibold",
                          )}
                          aria-label={count > 0 ? `${c.name}, ${count} unread` : c.name}
                        >
                          <Icon className="opacity-70" aria-hidden />
                          <span className="truncate">{c.name}</span>
                        </SidebarMenuButton>
                        {count > 0 && !active && (
                          <SidebarMenuBadge className="bg-primary text-primary-foreground top-2.5 rounded-full px-1.5 md:top-1.5">
                            {formatCount(count)}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </>
  );
}
