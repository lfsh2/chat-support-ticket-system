"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Hash, Megaphone } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PROGRAMS } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useHub, type HubChannel } from "./hub-context";

const GROUPS: { key: HubChannel["program"]; label: string; accent?: string }[] = [
  { key: null, label: "Everyone" },
  { key: "coachos", label: PROGRAMS.coachos.label, accent: PROGRAMS.coachos.accent },
  { key: "alive_free", label: PROGRAMS.alive_free.label, accent: PROGRAMS.alive_free.accent },
];

export function formatCount(n: number) {
  return n > 99 ? "99+" : String(n);
}

/**
 * Channel groups for the desktop sidebar, the mobile sheet, and the Chat tab.
 * `tabbed` turns the active channel into a paper tab that joins the page (desktop sidebar only).
 */
export function ChannelNav({ onNavigate, tabbed = false }: { onNavigate?: () => void; tabbed?: boolean }) {
  const { channels, unread } = useHub();
  const pathname = usePathname();

  return (
    <>
      {GROUPS.map((group) => {
        const list = channels.filter((c) => c.program === group.key);
        if (list.length === 0) return null;
        return (
          <Collapsible key={group.label} defaultOpen render={<SidebarGroup className="py-1" />}>
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className="group/label text-sidebar-foreground/75 hover:text-sidebar-foreground h-9 cursor-pointer gap-2 px-2 text-[15px] font-normal"
            >
              <span
                className="h-3.5 w-[3px] shrink-0 rounded-full"
                style={{ background: group.accent ?? "currentColor", opacity: group.accent ? 1 : 0.35 }}
                aria-hidden
              />
              <span className="note">{group.label}</span>
              <ChevronRight
                className="ml-auto size-3.5 opacity-50 transition-transform duration-200 group-data-[panel-open]/label:rotate-90"
                aria-hidden
              />
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu className="gap-px">
                  {list.map((c) => {
                    const href = `/c/${c.slug}`;
                    const count = unread[c.id] ?? 0;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    const hasUnread = count > 0 && !active;
                    const Icon = c.type === "announcement" ? Megaphone : Hash;
                    return (
                      <SidebarMenuItem key={c.id}>
                        <SidebarMenuButton
                          isActive={active}
                          render={<Link href={href} onClick={onNavigate} />}
                          className={cn(
                            "h-11 cursor-pointer gap-2.5 text-[15px] md:h-8 md:text-sm",
                            hasUnread && "text-sidebar-accent-foreground font-semibold",
                            tabbed &&
                              "md:data-active:paper md:data-active:text-foreground md:data-active:w-[calc(100%+0.5rem)] md:data-active:rounded-r-none md:data-active:font-semibold",
                          )}
                          aria-label={count > 0 ? `${c.name}, ${count} unread` : c.name}
                        >
                          <Icon className="opacity-60" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                          {hasUnread && (
                            <span className="bg-sidebar-accent-foreground text-[var(--badge-ink,var(--sidebar))] ml-auto rounded-[4px] px-1.5 text-[11px] leading-[18px] font-bold tabular-nums">
                              {formatCount(count)}
                            </span>
                          )}
                        </SidebarMenuButton>
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
