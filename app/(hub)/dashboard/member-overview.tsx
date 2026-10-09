import Link from "next/link";
import { UnreadChannels } from "@/components/dashboard/unread-channels";
import { GetHelpButton } from "@/components/tickets/new-ticket-flow";
import { StatusBadge } from "@/components/tickets/ticket-tags";
import { toPlainText } from "@/lib/markdown";
import { myPrograms, requireHubAccess } from "@/lib/session";
import { OPEN_STATUSES, TICKET_LIST_SELECT, type TicketListRow } from "@/lib/tickets";
import { dayLabel, formatAge, safeTimeZone } from "@/lib/time";
import { Panel } from "./overview-bits";

/** A client's home: their open tickets, a way to get help, and what's new in the hub. */
export async function MemberOverview() {
  const { supabase, profile } = await requireHubAccess();
  const timeZone = safeTimeZone(profile.timezone);
  const programs = await myPrograms();

  const [{ data: ticketData }, { data: announcementsChannel }] = await Promise.all([
    supabase
      .from("tickets")
      .select(TICKET_LIST_SELECT)
      .eq("requester_id", profile.id)
      .in("status", OPEN_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("channels").select("id").eq("slug", "announcements").maybeSingle(),
  ]);
  const tickets = (ticketData ?? []) as unknown as TicketListRow[];
  const waitingOnMe = tickets.filter((t) => t.status === "waiting_on_client");

  const { data: latest } = announcementsChannel
    ? await supabase
        .from("messages")
        .select("id, body, created_at, author:profiles!messages_author_id_fkey(display_name)")
        .eq("channel_id", announcementsChannel.id)
        .is("parent_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <>
      {waitingOnMe.length > 0 && (
        <Link
          href={`/dashboard/tickets/${waitingOnMe[0].number}`}
          className="border-warning hover:bg-muted/50 flex items-center gap-4 rounded-xl border-l-[3px] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] px-4 py-3 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {waitingOnMe.length === 1 ? "The team is waiting on your reply" : `${waitingOnMe.length} tickets are waiting on your reply`}
            </p>
            <p className="text-muted-foreground truncate text-sm">#{waitingOnMe[0].number} · {waitingOnMe[0].subject}</p>
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">Reply →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr] lg:gap-12">
        <div className="flex flex-col gap-10">
          <Panel title="Your tickets" href="/dashboard/tickets" linkLabel="All tickets">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-start gap-4 py-3">
                <p className="text-muted-foreground max-w-prose text-[15px]">
                  No open tickets. Stuck on something? Tell us what&apos;s going on — we usually reply within one business
                  day.
                </p>
                <GetHelpButton programs={programs} />
              </div>
            ) : (
              <>
                <ul>
                  {tickets.map((t) => (
                    <li key={t.id} className="border-rule border-b last:border-0">
                      <Link
                        href={`/dashboard/tickets/${t.number}`}
                        className="hover:bg-muted/60 -mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">{t.subject}</p>
                          <div className="mt-0.5 flex items-center gap-3">
                            <StatusBadge status={t.status} audience="member" />
                            <span className="text-muted-foreground text-xs tabular-nums">#{t.number}</span>
                          </div>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {formatAge(new Date(t.updated_at ?? 0), timeZone)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="pt-4">
                  <GetHelpButton programs={programs} className="h-11">
                    Ask something new
                  </GetHelpButton>
                </div>
              </>
            )}
          </Panel>

          {latest && (
            <Panel title="From the team" href="/c/announcements" linkLabel="Announcements">
              <article className="py-2">
                <p className="text-muted-foreground text-xs">
                  {(latest.author as { display_name: string } | null)?.display_name ?? "The team"} ·{" "}
                  {dayLabel(new Date(latest.created_at ?? 0), timeZone)}
                </p>
                <p className="mt-1 line-clamp-4 text-[15px] leading-relaxed">{toPlainText(latest.body)}</p>
              </article>
            </Panel>
          )}
        </div>

        <Panel title="Catch up" href="/c" linkLabel="All channels">
          <UnreadChannels />
        </Panel>
      </div>
    </>
  );
}
