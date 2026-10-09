"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LifeBuoy, ListChecks, Ticket } from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useHub } from "./hub-context";

/** Dashboard / Tickets / Tasks at the top of the sidebar. Tasks are team-only. */
export function WorkspaceNav({ onNavigate, tabbed = false }: { onNavigate?: () => void; tabbed?: boolean }) {
  const { isStaff } = useHub();
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Dashboard", icon: House, exact: true },
    { href: "/dashboard/tickets", label: isStaff ? "Tickets" : "My tickets", icon: isStaff ? Ticket : LifeBuoy },
    ...(isStaff ? [{ href: "/dashboard/tasks", label: "Tasks", icon: ListChecks }] : []),
  ];

  return (
    <SidebarGroup className="py-1">
      <SidebarGroupContent>
        <SidebarMenu className="gap-px">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={active}
                  render={<Link href={href} onClick={onNavigate} />}
                  className={cn(
                    "h-11 cursor-pointer gap-2.5 text-[15px] md:h-8 md:text-sm",
                    tabbed &&
                      "md:data-active:paper md:data-active:text-foreground md:data-active:w-[calc(100%+0.5rem)] md:data-active:rounded-r-none md:data-active:font-semibold",
                  )}
                >
                  <Icon className="opacity-70" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
