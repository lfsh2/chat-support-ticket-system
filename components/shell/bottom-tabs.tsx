"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleUserRound, LifeBuoy, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount } from "./channel-nav";
import { useHub } from "./hub-context";

const TABS = [
  { href: "/c", match: ["/c"], label: "Chat", icon: MessagesSquare },
  { href: "/help", match: ["/help", "/kb"], label: "Help", icon: LifeBuoy },
  { href: "/inbox", match: ["/inbox"], label: "Inbox", icon: Bell },
  { href: "/me", match: ["/me"], label: "Me", icon: CircleUserRound },
] as const;

export function BottomTabs() {
  const pathname = usePathname();
  const { unread } = useHub();
  const chatUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <nav
      aria-label="Main"
      className="paper border-rule border-t pb-[env(safe-area-inset-bottom)] md:hidden in-data-keyboard-open:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, match, label, icon: Icon }) => {
          const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          const badge = label === "Chat" && chatUnread > 0 ? formatCount(chatUnread) : null;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Ink tab marker instead of a tinted icon. */}
                <span
                  className={cn(
                    "bg-ink absolute top-0 h-[3px] w-8 rounded-b-full transition-opacity duration-200",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <span className="relative">
                  <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
                  {badge && (
                    <span className="bg-primary text-primary-foreground absolute -top-1 left-3.5 min-w-[18px] rounded-[4px] px-1 text-center text-[10px] leading-[16px] font-bold tabular-nums">
                      <span className="sr-only">, </span>
                      {badge}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
