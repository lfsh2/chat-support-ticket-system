"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, CircleUserRound, Hash, House, Inbox, LifeBuoy, ListChecks, Lock, Megaphone, Plus, Ticket } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { PROGRAMS } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { STATUS_META, type TicketStatus } from "@/lib/tickets";
import { useHub } from "./hub-context";

const OPEN_EVENT = "hub:open-command-menu";

/** Opens the ⌘K menu from anywhere (e.g. the search button in the top bar). */
export function openCommandMenu() {
  // Next tick: otherwise the tap that opened it also counts as a tap outside, and closes it.
  setTimeout(() => window.dispatchEvent(new Event(OPEN_EVENT)), 0);
}

/** ⌘K / Ctrl+K: jump to a channel, a ticket or a page, or start a new ticket. */
export function CommandMenu() {
  const { channels, isStaff } = useHub();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Recent tickets: your own (clients) or everyone's (team). Loaded when the menu opens.
  const tickets = useQuery({
    queryKey: ["command-tickets"],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("number, subject, status")
        .order("updated_at", { ascending: false })
        .limit(isStaff ? 60 : 30);
      if (error) throw error;
      return data;
    },
  });

  const go = (href: string) => {
    setOpen(false);
    setSearch("");
    router.push(href);
  };

  const ticketNumber = /^#?(\d{1,9})$/.exec(search.trim())?.[1];
  const listed = ticketNumber && tickets.data?.some((t) => String(t.number) === ticketNumber);

  const pages = [
    { href: "/dashboard", label: "Dashboard", icon: House },
    { href: "/dashboard/tickets", label: isStaff ? "Tickets" : "My tickets", icon: isStaff ? Ticket : LifeBuoy },
    ...(isStaff ? [{ href: "/dashboard/tasks", label: "Tasks", icon: ListChecks }] : []),
    { href: "/inbox", label: "Inbox", icon: Bell },
    { href: "/me", label: "Profile and settings", icon: CircleUserRound },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
      title="Quick search"
      description="Jump to a channel, a ticket or a page"
      className="max-w-[calc(100%-2rem)] sm:max-w-lg"
    >
      <Command>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search channels, tickets and pages…"
        className="text-base md:text-sm"
      />
      <CommandList className="max-h-[min(26rem,60dvh)]">
        <CommandEmpty>Nothing matches “{search}”.</CommandEmpty>

        {!isStaff && (
          <CommandGroup heading="Need a hand?">
            <CommandItem value="get help new ticket ask the team" onSelect={() => go("/dashboard/tickets?new=1")} className="min-h-11">
              <Plus aria-hidden /> Get help (open a ticket)
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Channels">
          {channels.map((c) => {
            const Icon = c.client_id ? Lock : c.staff_only ? Inbox : c.type === "announcement" ? Megaphone : Hash;
            return (
              <CommandItem
                key={c.id}
                value={`channel ${c.name} ${c.program ? PROGRAMS[c.program].label : ""}`}
                onSelect={() => go(`/c/${c.slug}`)}
                className="min-h-11"
              >
                <Icon aria-hidden />
                <span className="truncate">{c.name}</span>
                {c.program && (
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: PROGRAMS[c.program].accent }}
                    role="img"
                    aria-label={PROGRAMS[c.program].label}
                  />
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {(tickets.data?.length || (ticketNumber && !listed)) && (
          <CommandGroup heading={isStaff ? "Recent tickets" : "Your tickets"}>
            {ticketNumber && !listed && (
              <CommandItem value={`ticket #${ticketNumber} ${ticketNumber}`} onSelect={() => go(`/dashboard/tickets/${ticketNumber}`)} className="min-h-11">
                <Ticket aria-hidden /> Open ticket #{ticketNumber}
              </CommandItem>
            )}
            {tickets.data?.map((t) => {
              const meta = STATUS_META[t.status as TicketStatus];
              return (
                <CommandItem
                  key={t.number}
                  value={`ticket #${t.number} ${t.number} ${t.subject}`}
                  onSelect={() => go(`/dashboard/tickets/${t.number}`)}
                  className="min-h-11"
                >
                  <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
                  <span className="text-muted-foreground tabular-nums">#{t.number}</span>
                  <span className="truncate">{t.subject}</span>
                  <span className="sr-only">, {isStaff ? meta.label : meta.memberLabel}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandGroup heading="Go to">
          {pages.map(({ href, label, icon: Icon }) => (
            <CommandItem key={href} value={`page ${label}`} onSelect={() => go(href)} className="min-h-11">
              <Icon aria-hidden /> {label}
              {href === "/inbox" && <CommandShortcut className="hidden md:inline">Mentions & replies</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
