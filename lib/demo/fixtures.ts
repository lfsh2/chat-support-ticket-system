import type { Database, Tables } from "@/lib/database.types";

type Row<T extends keyof Database["public"]["Tables"]> = Tables<T>;

export const U = {
  casey: "00000000-0000-4000-a000-000000000001",
  alex: "00000000-0000-4000-a000-000000000002",
  bailey: "00000000-0000-4000-a000-000000000003",
  jon: "00000000-0000-4000-a000-000000000004",
  sammi: "00000000-0000-4000-a000-000000000005",
  lee: "00000000-0000-4000-a000-000000000006",
} as const;

const C = {
  announcements: "10000000-0000-4000-a000-000000000001",
  general: "10000000-0000-4000-a000-000000000002",
  wins: "10000000-0000-4000-a000-000000000003",
  coachosHelp: "10000000-0000-4000-a000-000000000004",
  techSetup: "10000000-0000-4000-a000-000000000005",
  featureRequests: "10000000-0000-4000-a000-000000000006",
  community: "10000000-0000-4000-a000-000000000007",
  resources: "10000000-0000-4000-a000-000000000008",
} as const;

export type DemoTables = {
  profiles: Row<"profiles">[];
  memberships: Row<"memberships">[];
  channels: Row<"channels">[];
  messages: Row<"messages">[];
  reactions: Row<"reactions">[];
  read_states: Row<"read_states">[];
  tickets: Row<"tickets">[];
  tasks: Row<"tasks">[];
  events: Row<"events">[];
};

/** Fresh sample data, with timestamps relative to "now" so it always looks current. */
export function buildFixtures(now = Date.now()): DemoTables {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  const profile = (id: string, email: string, display_name: string, role: Row<"profiles">["role"] = "member") => ({
    id,
    email,
    display_name,
    avatar_url: null,
    bio: null,
    timezone: "America/New_York",
    role,
    notification_prefs: {},
    created_at: ago(60 * 24 * 30),
  });

  const membership = (email: string, user_id: string, program: Row<"memberships">["program"], status: Row<"memberships">["status"]) => ({
    id: `${user_id}-${program}`,
    email,
    user_id,
    program,
    status,
    source: status === "manual" ? "manual" : "stripe",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
    grace_until: null,
    created_at: ago(60 * 24 * 30),
  });

  const channel = (
    id: string,
    slug: string,
    description: string,
    program: Row<"channels">["program"],
    position: number,
    type: Row<"channels">["type"] = "text",
  ) => ({ id, slug, name: slug, description, program, type, position, archived_at: null });

  let n = 0;
  const msg = (channel_id: string, author_id: string, minutesAgo: number, body: string) => ({
    id: `20000000-0000-4000-a000-${String(++n).padStart(12, "0")}`,
    channel_id,
    ticket_id: null,
    parent_id: null,
    author_id,
    kind: "user",
    body,
    attachments: [],
    via: "web",
    reply_count: 0,
    edited_at: null,
    deleted_at: null,
    created_at: ago(minutesAgo),
  });

  const messages: Row<"messages">[] = [
    msg(C.announcements, U.sammi, 60 * 26, "Welcome to the new **Client Hub**! 🎉\n\nThis is your place to chat with our team and other clients, get help when you're stuck, and find answers. Say hi in #general."),
    msg(C.announcements, U.sammi, 95, "**New this month:** live Q&A every Thursday at 12pm ET. Drop your questions in #general ahead of time and we'll cover as many as we can."),
    msg(C.general, U.casey, 60 * 25, "Hi everyone! Just joined — excited to be here 👋"),
    msg(C.general, U.alex, 60 * 25 - 4, "Welcome Casey! 🙌"),
    msg(C.general, U.bailey, 60 * 3, "Anyone else working on a spring launch this week? Would love an accountability buddy."),
    msg(C.general, U.alex, 60 * 3 - 2, "Me! Launching my group program on the 15th."),
    msg(C.general, U.jon, 42, "We're around all day if anything comes up. You can also open a ticket anytime from **Get help** — we usually reply within one business day."),
    msg(C.wins, U.alex, 60 * 20, "Booked **3 discovery calls** from last week's email! 🎉"),
    msg(C.wins, U.bailey, 25, "Finally finished my website copy ✅ It only took three drafts and a lot of coffee."),
    msg(C.coachosHelp, U.casey, 60 * 5, "How do I connect my calendar to the booking page?"),
    msg(C.coachosHelp, U.jon, 60 * 5 - 6, "Go to **Settings → Integrations → Calendar**, then pick Google or Outlook. It syncs within a minute or two."),
    msg(C.coachosHelp, U.casey, 60 * 5 - 9, "That worked, thank you!"),
    msg(C.techSetup, U.bailey, 60 * 2, "My domain says `pending verification` — how long does that usually take?"),
    msg(C.techSetup, U.jon, 60 * 2 - 5, "Usually under an hour. If it's been longer, double-check the CNAME record:\n- Name: `www`\n- Value: the one shown in **Settings → Domains**"),
    msg(C.featureRequests, U.casey, 60 * 30, "Would love a way to send automatic reminders the day before a session."),
    msg(C.featureRequests, U.sammi, 60 * 29, "Great idea — adding it to the list 👀"),
    msg(C.community, U.alex, 60 * 6, "What's everyone's morning routine looking like lately?"),
    msg(C.community, U.bailey, 60 * 6 - 12, "Journaling and a walk before I open my laptop. *Game changer.*"),
    msg(C.resources, U.sammi, 60 * 48, "This week's workbook: [Clarifying your offer](https://aliveandfreeconsulting.com). Print it or fill it in on screen."),
  ];

  const reactions: Row<"reactions">[] = [
    { message_id: messages[0].id, user_id: U.casey, emoji: "🎉" },
    { message_id: messages[0].id, user_id: U.alex, emoji: "🎉" },
    { message_id: messages[0].id, user_id: U.bailey, emoji: "❤️" },
    { message_id: messages[3].id, user_id: U.casey, emoji: "❤️" },
    { message_id: messages[7].id, user_id: U.bailey, emoji: "🎉" },
    { message_id: messages[7].id, user_id: U.sammi, emoji: "🎉" },
    { message_id: messages[7].id, user_id: U.jon, emoji: "👏" },
    { message_id: messages[11].id, user_id: U.jon, emoji: "🙏" },
    { message_id: messages[15].id, user_id: U.casey, emoji: "🙏" },
  ];

  // ---- tickets ------------------------------------------------------------------
  const T = {
    domain: "30000000-0000-4000-a000-000000000001",
    annual: "30000000-0000-4000-a000-000000000002",
    calendar: "30000000-0000-4000-a000-000000000003",
    workbook: "30000000-0000-4000-a000-000000000004",
  } as const;

  const ticket = (
    id: string,
    number: number,
    requester_id: string,
    program: Row<"tickets">["program"],
    category: Row<"tickets">["category"],
    subject: string,
    o: Partial<Row<"tickets">> & { openedAgo: number; updatedAgo: number },
  ): Row<"tickets"> => ({
    id,
    number,
    requester_id,
    program,
    category,
    subject,
    priority: o.priority ?? "normal",
    status: o.status ?? "new",
    assignee_id: o.assignee_id ?? null,
    first_response_at: o.first_response_at ?? null,
    resolved_at: o.resolved_at ?? null,
    satisfaction: o.satisfaction ?? null,
    created_at: ago(o.openedAgo),
    updated_at: ago(o.updatedAgo),
  });

  const tickets = [
    ticket(T.domain, 1041, U.casey, "coachos", "website_domain", "My domain still says pending verification", {
      priority: "high",
      status: "open",
      assignee_id: U.jon,
      first_response_at: ago(60 * 4),
      openedAgo: 60 * 5,
      updatedAgo: 60 * 2,
    }),
    ticket(T.annual, 1042, U.alex, "alive_free", "billing", "Can I switch to the annual plan?", { openedAgo: 50, updatedAgo: 50 }),
    ticket(T.calendar, 1043, U.bailey, "coachos", "tech", "Calendar not syncing with booking page", {
      status: "resolved",
      assignee_id: U.jon,
      first_response_at: ago(60 * 24 * 3 - 20),
      resolved_at: ago(60 * 24 * 2),
      openedAgo: 60 * 24 * 3,
      updatedAgo: 60 * 24 * 2,
    }),
    ticket(T.workbook, 1044, U.bailey, "alive_free", "coaching", "Question about this week's workbook", {
      status: "waiting_on_client",
      assignee_id: U.sammi,
      first_response_at: ago(60 * 20),
      openedAgo: 60 * 26,
      updatedAgo: 60 * 20,
    }),
  ];

  const tmsg = (ticket_id: string, author_id: string | null, minutesAgo: number, body: string, kind = "user") => ({
    ...msg("", author_id ?? "", minutesAgo, body),
    channel_id: null,
    ticket_id,
    author_id,
    kind,
  });

  messages.push(
    tmsg(T.domain, U.casey, 60 * 5, "I added the CNAME record yesterday but CoachOS still says **pending verification**. Is something wrong?"),
    tmsg(T.domain, U.jon, 60 * 4 + 1, "picked up this ticket", "system"),
    tmsg(T.domain, U.jon, 60 * 4, "Thanks Casey, I'm taking a look now. Could you send a screenshot of your DNS page in GoDaddy?"),
    tmsg(T.domain, U.casey, 60 * 2, "Sure, here you go. The record is `www` → the value from Settings."),
    tmsg(T.domain, U.jon, 110, "Their CNAME is missing the trailing dot. I'll record a quick Loom walking them through it.", "internal_note"),
    tmsg(T.annual, U.alex, 50, "I'd like to move to annual billing to save a bit. How do I do that?"),
    tmsg(T.calendar, U.bailey, 60 * 24 * 3, "New bookings aren't showing on my Google Calendar."),
    tmsg(T.calendar, U.jon, 60 * 24 * 3 - 20, "Reconnect it under **Settings → Integrations → Calendar** and it should catch up within a minute."),
    tmsg(T.calendar, U.bailey, 60 * 24 * 2 + 5, "That fixed it, thanks!"),
    tmsg(T.calendar, U.jon, 60 * 24 * 2, "marked this resolved", "system"),
    tmsg(T.workbook, U.bailey, 60 * 26, "Is the *Clarifying your offer* workbook meant to be done before Thursday's call?"),
    tmsg(T.workbook, U.sammi, 60 * 20 + 1, "picked up this ticket", "system"),
    tmsg(T.workbook, U.sammi, 60 * 20, "Yes please! Even a rough first pass helps. Which section are you stuck on?"),
    tmsg(T.workbook, U.sammi, 60 * 20 - 1, "is waiting on a reply from the client", "system"),
  );

  // ---- team tasks -----------------------------------------------------------------
  const day = (offset: number) => new Date(now + offset * 86_400_000).toISOString().slice(0, 10);
  let k = 0;
  const task = (
    title: string,
    o: Partial<Row<"tasks">> & { createdAgo: number },
  ): Row<"tasks"> => ({
    id: `40000000-0000-4000-a000-${String(++k).padStart(12, "0")}`,
    title,
    notes: o.notes ?? null,
    status: o.status ?? "todo",
    priority: o.priority ?? "normal",
    assignee_id: o.assignee_id ?? null,
    created_by: o.created_by ?? U.jon,
    ticket_id: o.ticket_id ?? null,
    due_on: o.due_on ?? null,
    completed_at: o.status === "done" ? ago(o.createdAgo / 2) : null,
    created_at: ago(o.createdAgo),
    updated_at: ago(o.createdAgo),
  });

  const tasks = [
    task("Walk Casey through the CNAME fix", {
      notes: "Record a short Loom showing the trailing-dot issue.",
      status: "in_progress",
      priority: "high",
      assignee_id: U.jon,
      ticket_id: T.domain,
      due_on: day(0),
      createdAgo: 110,
    }),
    task("Reply to Alex about annual billing", { ticket_id: T.annual, due_on: day(1), createdAgo: 45 }),
    task("Write KB article: calendar sync troubleshooting", {
      notes: "Based on Bailey's ticket.",
      assignee_id: U.jon,
      ticket_id: T.calendar,
      due_on: day(5),
      createdAgo: 60 * 24 * 2,
    }),
    task("Prep questions for Thursday's live Q&A", { assignee_id: U.sammi, due_on: day(-1), createdAgo: 60 * 24 * 4 }),
    task("Follow up with Bailey on the workbook", { assignee_id: U.sammi, ticket_id: T.workbook, due_on: day(2), createdAgo: 60 * 20 }),
    task("Update onboarding checklist for new CoachOS clients", { status: "done", assignee_id: U.jon, createdAgo: 60 * 24 * 6 }),
  ];

  // ---- calendar events (noon / 3pm Eastern on nearby days) ------------------------
  const eastern = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(now + dayOffset * 86_400_000);
    const [y, m, dd] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d).split("-").map(Number);
    // Eastern is UTC-4 (summer) or UTC-5 (winter); work out which for this date.
    const probe = new Date(Date.UTC(y, m - 1, dd, 12));
    const offset = probe.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).endsWith("EDT") ? 4 : 5;
    return new Date(Date.UTC(y, m - 1, dd, hour + offset, minute)).toISOString();
  };
  const event = (id: number, title: string, o: Partial<Row<"events">> & { starts_at: string }): Row<"events"> => ({
    id: `50000000-0000-4000-a000-${String(id).padStart(12, "0")}`,
    title,
    description: o.description ?? null,
    program: o.program ?? null,
    starts_at: o.starts_at,
    ends_at: o.ends_at ?? null,
    link: o.link ?? null,
    created_by: o.created_by ?? U.sammi,
    created_at: ago(60 * 24 * 7),
  });
  const events = [
    event(1, "Live Q&A", {
      description: "Bring your questions — we'll cover as many as we can.",
      starts_at: eastern(1, 12),
      ends_at: eastern(1, 13),
      link: "https://zoom.us",
    }),
    event(2, "CoachOS office hours", {
      description: "Drop in with setup questions: domains, calendars, email.",
      program: "coachos",
      starts_at: eastern(2, 15),
      ends_at: eastern(2, 16),
      link: "https://zoom.us",
      created_by: U.jon,
    }),
    event(3, "Alive & Free workshop: Clarifying your offer", {
      program: "alive_free",
      starts_at: eastern(6, 12),
      ends_at: eastern(6, 13, 30),
    }),
    event(4, "Live Q&A", { starts_at: eastern(8, 12), ends_at: eastern(8, 13), link: "https://zoom.us" }),
  ];

  const users = [
    profile(U.casey, "coachos@example.com", "Casey Morgan"),
    profile(U.alex, "alivefree@example.com", "Alex Rivera"),
    profile(U.bailey, "both@example.com", "Bailey Chen"),
    profile(U.jon, "agent@example.com", "Jon (Support)", "agent"),
    profile(U.sammi, "owner@example.com", "Sammi Robbins", "owner"),
    profile(U.lee, "lapsed@example.com", "Lee Parker"),
  ];

  const channels = [
    channel(C.announcements, "announcements", "News from the team", null, 0, "announcement"),
    channel(C.general, "general", "Say hi and chat with everyone", null, 1),
    channel(C.wins, "wins", "Share your wins, big and small", null, 2),
    channel(C.coachosHelp, "coachos-help", "Questions about using CoachOS", "coachos", 10),
    channel(C.techSetup, "tech-setup", "Domains, email and integrations", "coachos", 11),
    channel(C.featureRequests, "feature-requests", "Ideas to make CoachOS better", "coachos", 12),
    channel(C.community, "community", "The Alive & Free community", "alive_free", 20),
    channel(C.resources, "resources", "Worksheets, recordings and links", "alive_free", 21),
  ];

  // Everyone has read everything up to ~4 hours ago, so recent posts show as unread.
  const read_states = users.flatMap((u) =>
    channels.map((c) => ({ user_id: u.id, channel_id: c.id, ticket_id: null, last_read_at: ago(60 * 4) })),
  );

  return {
    profiles: users,
    memberships: [
      membership("coachos@example.com", U.casey, "coachos", "active"),
      membership("alivefree@example.com", U.alex, "alive_free", "active"),
      membership("both@example.com", U.bailey, "coachos", "active"),
      membership("both@example.com", U.bailey, "alive_free", "manual"),
      membership("lapsed@example.com", U.lee, "coachos", "canceled"),
    ],
    channels,
    messages,
    reactions,
    read_states,
    tickets,
    tasks,
    events,
  };
}
