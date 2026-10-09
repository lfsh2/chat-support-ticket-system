import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shell/empty-state";
import { GetHelpButton } from "@/components/tickets/new-ticket-flow";
import { StatusBadge } from "@/components/tickets/ticket-tags";
import { requireHubAccess } from "@/lib/session";
import { toPlainText } from "@/lib/markdown";
import { formatAge, safeTimeZone } from "@/lib/time";
import { TICKET_LIST_SELECT, isOpenStatus, type TicketListRow } from "@/lib/tickets";
import type { Program } from "@/lib/access";

/** A client's own tickets, Open / Resolved, each with the latest message as a preview. */
export async function MemberTickets({ programs }: { programs: Program[] }) {
  const { supabase, profile } = await requireHubAccess();
  const timeZone = safeTimeZone(profile.timezone);

  const { data } = await supabase
    .from("tickets")
    .select(TICKET_LIST_SELECT)
    .eq("requester_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  const tickets = (data ?? []) as unknown as TicketListRow[];

  const previews = new Map<string, { body: string; mine: boolean }>();
  if (tickets.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("ticket_id, author_id, body, created_at")
      .in(
        "ticket_id",
        tickets.map((t) => t.id),
      )
      .eq("kind", "user")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    for (const m of msgs ?? []) {
      if (m.ticket_id && !previews.has(m.ticket_id)) previews.set(m.ticket_id, { body: m.body, mine: m.author_id === profile.id });
    }
  }

  const open = tickets.filter((t) => isOpenStatus(t.status));
  const done = tickets.filter((t) => !isOpenStatus(t.status));

  const list = (rows: TicketListRow[], empty: React.ReactNode) =>
    rows.length === 0 ? (
      empty
    ) : (
      <ul className="border-rule border-t">
        {rows.map((t) => {
          const p = previews.get(t.id);
          return (
            <li key={t.id} className="border-rule border-b">
              <Link
                href={`/dashboard/tickets/${t.number}`}
                className="hover:bg-muted/60 flex min-h-[4.5rem] items-start gap-3 px-5 py-3.5 transition-colors md:px-10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[15px] font-semibold">{t.subject}</span>
                  </div>
                  {p && (
                    <p className="text-muted-foreground mt-0.5 truncate text-sm">
                      {p.mine ? "You: " : ""}
                      {toPlainText(p.body) || "Sent an attachment"}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3">
                    <StatusBadge status={t.status} audience="member" />
                    <span className="text-muted-foreground text-xs tabular-nums">#{t.number}</span>
                  </div>
                </div>
                <time
                  dateTime={t.updated_at ?? undefined}
                  className="text-muted-foreground shrink-0 pt-0.5 text-xs tabular-nums"
                >
                  {formatAge(new Date(t.updated_at ?? 0), timeZone)}
                </time>
              </Link>
            </li>
          );
        })}
      </ul>
    );

  return (
    <Tabs defaultValue="open" className="gap-0 pt-4">
      <TabsList variant="line" className="mx-3 md:mx-8">
        <TabsTrigger value="open" className="h-10 cursor-pointer px-3 text-sm">
          Open{open.length ? ` (${open.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="resolved" className="h-10 cursor-pointer px-3 text-sm">
          Resolved
        </TabsTrigger>
      </TabsList>
      <TabsContent value="open" className="pt-3">
        {list(
          open,
          <EmptyState
            eyebrow="Your tickets"
            title="No open tickets."
            action={<GetHelpButton programs={programs} />}
          >
            Stuck on something? Tell us what&apos;s going on and we&apos;ll take it from there. We usually reply within
            one business day.
          </EmptyState>,
        )}
      </TabsContent>
      <TabsContent value="resolved" className="pt-3">
        {list(
          done,
          <EmptyState eyebrow="Resolved" title="Nothing here yet.">
            When we&apos;ve sorted something out for you, it moves here so you can find it again.
          </EmptyState>,
        )}
      </TabsContent>
    </Tabs>
  );
}
