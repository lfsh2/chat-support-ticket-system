import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketView, type TicketDetail } from "@/components/tickets/ticket-view";
import type { TicketPanelData } from "@/components/tickets/ticket-panel";
import { isStaffRole, STAFF_ROLES } from "@/lib/access";
import { MESSAGE_SELECT, PAGE_SIZE, type ChatMessage } from "@/lib/chat/types";
import { APP_NAME } from "@/lib/config";
import { requireHubAccess } from "@/lib/session";
import { TASK_SELECT, type TaskRow } from "@/lib/tasks";
import { dayKey, safeTimeZone } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/dashboard/tickets/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Ticket #${number} · ${APP_NAME}` };
}

const TICKET_DETAIL_SELECT =
  "*, requester:profiles!tickets_requester_id_fkey(id, display_name, avatar_url, email), assignee:profiles!tickets_assignee_id_fkey(id, display_name, avatar_url)" as const;

export default async function TicketPage({ params }: PageProps<"/dashboard/tickets/[number]">) {
  const { number } = await params;
  if (!/^\d{1,9}$/.test(number)) notFound();
  const { supabase, profile } = await requireHubAccess();

  // RLS: clients only ever find their own tickets.
  const { data } = await supabase.from("tickets").select(TICKET_DETAIL_SELECT).eq("number", Number(number)).maybeSingle();
  if (!data) notFound();
  const ticket = data as unknown as TicketDetail & { requester: { email: string } | null };

  const messagesQuery = supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("ticket_id", ticket.id)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (!isStaffRole(profile.role)) {
    const { data: messages } = await messagesQuery;
    return <TicketView key={ticket.id} ticket={ticket} initialMessages={(messages ?? []) as unknown as ChatMessage[]} panel={null} />;
  }

  const [{ data: messages }, { data: staff }, { data: memberships }, { data: past }, { data: tasks }] = await Promise.all([
    messagesQuery,
    supabase.from("profiles").select("id, display_name, avatar_url").in("role", STAFF_ROLES).order("display_name"),
    supabase.from("memberships").select("program, status, grace_until").eq("user_id", ticket.requester_id),
    supabase
      .from("tickets")
      .select("id, number, subject, status")
      .eq("requester_id", ticket.requester_id)
      .order("updated_at", { ascending: false })
      .limit(7),
    supabase.from("tasks").select(TASK_SELECT).eq("ticket_id", ticket.id).order("created_at"),
  ]);

  const panel: TicketPanelData = {
    ticket,
    requester: ticket.requester
      ? { id: ticket.requester.id, display_name: ticket.requester.display_name, avatar_url: ticket.requester.avatar_url, email: ticket.requester.email }
      : null,
    memberships: memberships ?? [],
    pastTickets: (past ?? []).filter((t) => t.id !== ticket.id).slice(0, 6),
    staff: staff ?? [],
    tasks: (tasks ?? []) as unknown as TaskRow[],
    today: dayKey(new Date(), safeTimeZone(profile.timezone)),
  };

  return <TicketView key={ticket.id} ticket={ticket} initialMessages={(messages ?? []) as unknown as ChatMessage[]} panel={panel} />;
}
