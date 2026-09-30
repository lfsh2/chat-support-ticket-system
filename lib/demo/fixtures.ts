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

  const messages = [
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
  };
}
