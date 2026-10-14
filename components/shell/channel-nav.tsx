"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Hash, Lock, Megaphone } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { PROGRAMS } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useHub, type HubChannel, type UnreadCounts } from "./hub-context";

const GROUPS: { key: HubChannel["program"]; label: string; accent?: string }[] = [
  { key: null, label: "Everyone" },
  { key: "coachos", label: PROGRAMS.coachos.label, accent: PROGRAMS.coachos.accent },
  { key: "alive_free", label: PROGRAMS.alive_free.label, accent: PROGRAMS.alive_free.accent },
];

/** Client channels shown under a parent before "Show N more". */
const CLIENT_PREVIEW = 5;

export function formatCount(n: number) {
  return n > 99 ? "99+" : String(n);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="bg-sidebar-accent-foreground text-[var(--badge-ink,var(--sidebar))] ml-auto shrink-0 rounded-[4px] px-1.5 text-[11px] leading-[18px] font-bold tabular-nums">
      {formatCount(count)}
    </span>
  );
}

/**
 * Channel groups for the desktop sidebar, the mobile sheet, and the Chat tab.
 * Private client channels nest under their parent (#coachos-help, #community).
 * `tabbed` turns the active channel into a paper tab that joins the page (desktop sidebar only).
 */
export function ChannelNav({ onNavigate, tabbed = false }: { onNavigate?: () => void; tabbed?: boolean }) {
  const { channels, unread } = useHub();
  const pathname = usePathname();

  return (
    <>
      {GROUPS.map((group) => {
        const list = channels.filter((c) => c.program === group.key && !c.parent_id);
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
                    const active = isActivePath(pathname, href);
                    const hasUnread = count > 0 && !active;
                    const Icon = c.type === "announcement" ? Megaphone : Hash;
                    const clients = channels.filter((x) => x.parent_id === c.id);
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
                          {hasUnread && <UnreadBadge count={count} />}
                        </SidebarMenuButton>
                        {clients.length > 0 && (
                          <ClientChannels
                            parentName={c.name}
                            channels={clients}
                            unread={unread}
                            pathname={pathname}
                            onNavigate={onNavigate}
                            tabbed={tabbed}
                          />
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

/** Private client channels under a parent: unread first, then A–Z; long lists fold. */
function ClientChannels({
  parentName,
  channels,
  unread,
  pathname,
  onNavigate,
  tabbed,
}: {
  parentName: string;
  channels: HubChannel[];
  unread: UnreadCounts;
  pathname: string;
  onNavigate?: () => void;
  tabbed: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...channels].sort(
    (a, b) => Number((unread[b.id] ?? 0) > 0) - Number((unread[a.id] ?? 0) > 0) || a.name.localeCompare(b.name),
  );
  // Folded lists still show the channel you're in.
  const shown = expanded
    ? sorted
    : sorted.filter((c, i) => i < CLIENT_PREVIEW || isActivePath(pathname, `/c/${c.slug}`));
  const hidden = sorted.length - shown.length;

  return (
    <SidebarMenuSub
      aria-label={`Client channels under ${parentName}`}
      className="border-sidebar-foreground/15 mr-0 ml-4 gap-px py-0.5 pr-0 pl-2"
    >
      {shown.map((c) => {
        const href = `/c/${c.slug}`;
        const count = unread[c.id] ?? 0;
        const active = isActivePath(pathname, href);
        const hasUnread = count > 0 && !active;
        return (
          <SidebarMenuSubItem key={c.id}>
            <SidebarMenuSubButton
              isActive={active}
              render={<Link href={href} onClick={onNavigate} />}
              className={cn(
                "h-11 cursor-pointer gap-2 text-[15px] md:h-7 md:text-[13px] [&>svg]:text-sidebar-foreground/60",
                hasUnread && "text-sidebar-accent-foreground font-semibold",
                tabbed &&
                  "md:data-active:paper md:data-active:text-foreground md:data-active:w-[calc(100%+0.5rem)] md:data-active:rounded-r-none md:data-active:font-semibold",
              )}
              aria-label={`${c.name}, private${count > 0 ? `, ${count} unread` : ""}`}
            >
              <Lock className="size-3.5" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {hasUnread && <UnreadBadge count={count} />}
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
      {(hidden > 0 || expanded) && sorted.length > CLIENT_PREVIEW && (
        <SidebarMenuSubItem>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground flex h-11 w-full cursor-pointer items-center px-2 text-left text-[13px] md:h-7 md:text-xs"
          >
            {expanded ? "Show fewer" : `Show ${hidden} more`}
          </button>
        </SidebarMenuSubItem>
      )}
    </SidebarMenuSub>
  );
}
