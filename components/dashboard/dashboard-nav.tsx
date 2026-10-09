"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHub } from "@/components/shell/hub-context";
import { cn } from "@/lib/utils";

/** Overview · Tickets · Tasks — ruled tabs under the page header. Tasks are team-only. */
export function DashboardNav({ counts }: { counts?: { tickets?: number; tasks?: number } }) {
  const pathname = usePathname();
  const { isStaff } = useHub();
  const items = [
    { href: "/dashboard", label: "Overview", exact: true },
    { href: "/dashboard/tickets", label: isStaff ? "Tickets" : "My tickets", count: counts?.tickets },
    ...(isStaff ? [{ href: "/dashboard/tasks", label: "Tasks", count: counts?.tasks }] : []),
  ];

  return (
    <nav aria-label="Dashboard" className="border-rule shrink-0 border-b px-2 md:px-4">
      <ul className="flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="bg-muted text-foreground rounded-[4px] px-1.5 text-[11px] leading-[18px] tabular-nums">
                    {item.count}
                  </span>
                ) : null}
                <span
                  className={cn("bg-ink absolute inset-x-3 bottom-0 h-[2px] rounded-t-full", active ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
