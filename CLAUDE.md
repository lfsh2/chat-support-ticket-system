# CLAUDE.md — Client Hub (Alive & Free + CoachOS Support Portal)

> Build spec for Claude Code. Read this whole file before writing any code.
> Work phase by phase (see §12). After each phase, run the app, check it on a
> 390px-wide mobile viewport, and confirm the acceptance criteria before moving on.

---

## 1. What we're building

A private, clients-only support hub that looks and feels like Slack/Discord,
but is simpler and friendlier for non-technical coaching clients.

- **Who gets in:** paying Alive & Free clients and active CoachOS subscribers. Nobody else.
- **What they do there:**
  1. Chat with our team and other clients in channels (Discord-style).
  2. Open support tickets, which behave like private chat threads with our team.
  3. Read announcements and self-serve help articles.
- **Owner:** Alive & Free Consulting (Spencer & Sammi Robbins). CoachOS is "powered by Alive + Free Consulting."
- **Support inbox today:** CoachOS@AliveAndFreeConsulting.com. The hub replaces scattered email threads, but email stays a first-class channel (notifications + reply-by-email).

Working product name: **Client Hub**. Keep it in one config constant so we can rename it.

### Non-negotiables
- **Mobile first.** Most clients will open this from a phone, often from an email link. Every screen is designed at 390px first, then scaled up.
- **Chat-app feel.** Sidebar of channels, message stream, sticky composer, threads, reactions, unread badges, realtime.
- **Friendlier than Slack.** Plain words, big tap targets, obvious "Get help" button, no jargon, empty states that tell people what to do.
- **shadcn/ui for every UI primitive.** Don't hand-roll buttons, dialogs, menus, inputs, etc.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (latest stable, App Router) + TypeScript (strict) |
| Styling | Tailwind CSS (version shadcn's current CLI installs) |
| Components | shadcn/ui (`npx shadcn@latest`), lucide-react icons |
| Auth, DB, Realtime, Storage | Supabase (`@supabase/ssr`), Postgres with Row Level Security |
| Payments / access | Stripe webhooks → `memberships` table |
| Outbound email | Resend + React Email templates |
| Inbound email (reply-by-email) | Postmark Inbound webhook (or Resend inbound if available — check current docs before choosing) |
| Forms / validation | react-hook-form + zod (via shadcn `form`) |
| Data fetching | Server Components + Server Actions; TanStack Query for client-side chat cache |
| Toasts | shadcn `sonner` |
| Dates | date-fns |
| Deploy | Vercel |
| Optional | GoHighLevel webhook sync (tags) — Phase 6 |

Use `pnpm`. No other UI kits (no MUI, Chakra, etc.).

---

## 3. Design direction

The two brands share one hub. The hub itself uses a calm, neutral shell. Each
program gets its own accent so members always know "which world" a channel belongs to.

### Tokens (put in `globals.css` as CSS variables, wired into shadcn's theme)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#FBFAF7` (warm paper) | `#0E1526` (midnight) | App background |
| `--sidebar` | `#131C33` (midnight navy) | `#0A1020` | Channel sidebar (dark in both modes, like Slack) |
| `--foreground` | `#1B2233` | `#E8ECF4` | Body text |
| `--primary` | `#2F5BEA` (CoachOS blue) | `#5B82FF` | Primary buttons, links, focus rings |
| `--accent-af` | `#C59267` (Alive & Free brown) | `#D9A87E` | Alive & Free channels, badges |
| `--accent-coachos` | `#2F5BEA` | `#5B82FF` | CoachOS channels, badges |
| `--success` | `#1F7A55` | `#3FB988` | Resolved tickets |
| `--warning` | `#B7791F` | `#E0A23B` | Waiting on client |
| `--destructive` | shadcn default | shadcn default | Errors, delete |

- **Type:** `Figtree` (Google Fonts via `next/font`) for everything. Scale: 12 / 14 / 15 (message body) / 17 / 20 / 24. Message body is 15px on mobile, line-height 1.5. Inputs are **16px minimum** on mobile (prevents iOS zoom).
- **Radius:** messages and inputs `0.75rem`; avatars fully round; sheets/drawers `1rem` top corners. Don't use one radius for everything.
- **Shadows:** almost none. Separate areas with background tone, not drop shadows.
- **Program marker:** each channel in the sidebar gets a small colored dot or program icon (brown for Alive & Free, blue for CoachOS, none for shared).
- **Motion:** only in response to user actions — message send (slide in from composer), reaction pop, sheet/drawer open, unread divider fade. Respect `prefers-reduced-motion`.
- **Dark mode:** supported via `next-themes`, default = system.
- **Copy voice:** plain, warm, sentence case. "Get help" not "Submit ticket request." "We usually reply within one business day." Errors say what happened and what to do.

---

## 4. Layout

### Mobile (< 768px) — primary target

```
┌─────────────────────────┐
│ ☰  # coachos-help    🔍 │  ← top bar: menu opens channel Sheet, title, search
├─────────────────────────┤
│  Today                  │
│  (A) Jon  10:02         │
│      Your domain is     │
│      connected ✅        │
│      👍 2   💬 3 replies │  ← reactions + thread link
│  ──── New messages ──── │  ← unread divider
│  (S) Sammi 10:15        │
│      Welcome everyone!  │
│                         │
├─────────────────────────┤
│ [+] Message #coachos… ➤ │  ← sticky composer, safe-area padding
├─────────────────────────┤
│  💬     🎫     🔔    👤  │  ← bottom tab bar
│ Chat  Help  Inbox   Me  │
└─────────────────────────┘
```

- **Bottom tab bar** (4 tabs): **Chat** (channels), **Help** (my tickets + "Get help" button), **Inbox** (mentions, replies, ticket updates), **Me** (profile, notifications, programs, sign out).
- **Channel list** opens as a left `Sheet` from ☰, and is also the default Chat tab screen when no channel is open.
- **Threads** open as a full-height `Drawer` (vaul) sliding up; swipe down to close.
- **Long-press a message** → `Drawer` with actions (react, reply in thread, copy, edit/delete own). On desktop the same actions appear in a hover toolbar + `ContextMenu`.
- **"Get help" FAB** on the Help tab opens the new-ticket flow as a `Drawer`.
- Use `100dvh`, `env(safe-area-inset-*)`, and `visualViewport` to keep the composer above the on-screen keyboard. Hide the bottom tab bar while the keyboard is open.
- All tap targets ≥ 44×44px.

### Tablet / desktop (≥ 768px)

```
┌────────────┬──────────────────────────────┬─────────────┐
│ Client Hub │ # coachos-help   👥 42  🔍 ⌘K │  Thread     │
│            ├──────────────────────────────┤  (optional) │
│ ★ Get help │  message stream              │             │
│            │                              │             │
│ Shared     │                              │             │
│ # announce │                              │             │
│ # general  │                              │             │
│ CoachOS    │                              │             │
│ # help   3 │                              │             │
│ Alive&Free │                              │             │
│ # community│                              │             │
│ My tickets │                              │             │
│ 🎫 #1042 ● ├──────────────────────────────┤             │
│ (me) ⚙     │ [+] Message…            ➤    │             │
└────────────┴──────────────────────────────┴─────────────┘
```

- Use shadcn `Sidebar` (collapsible) for the left column.
- Thread panel opens on the right; below `lg` it opens as a `Sheet` instead.
- `⌘K` / `Ctrl+K` opens a `Command` palette: jump to channel, ticket, or help article; start a new ticket.

---

## 5. Features

### 5.1 Auth & access (clients only)
- Sign-in with **email magic link** (Supabase OTP). Optional password later.
- **No open sign-up.** On the sign-in form, a server action checks the email has an active membership (or an admin invite) before sending the link. If not: "We couldn't find an active membership for this email. Use the email you paid with, or contact CoachOS@AliveAndFreeConsulting.com."
- A user can hold **multiple programs** (`alive_free`, `coachos`). Channels and help articles are filtered by program.
- Middleware protects every route except `/login`, `/auth/*`, and webhook routes.
- If a membership lapses mid-session, next request redirects to `/access-ended` with a friendly renewal message and a link to billing.

### 5.2 Channels (Discord-style chat)
- Seeded channels:
  - Shared: `#announcements` (read-only for members), `#general`, `#wins`
  - CoachOS: `#coachos-help`, `#tech-setup`, `#feature-requests`
  - Alive & Free: `#community`, `#resources`
- Channel types: `text`, `announcement` (only staff post; members can react and reply in threads).
- Messages support: markdown-lite (bold, italic, links, code, lists), @mentions (with `Popover` autocomplete), emoji reactions, threads, image/file attachments (Supabase Storage, 10 MB limit, images show inline preview), edit and delete own messages, link previews (optional, later).
- **Realtime:** new messages, edits, reactions, and typing indicators via Supabase Realtime (Postgres changes for data, Broadcast for typing, Presence for online dots).
- **Optimistic send:** message appears instantly with a subtle "sending" state; on failure show retry.
- **Unread tracking:** per-channel `last_read_at`; bold channel name + count badge; "New messages" divider; "Jump to latest" floating button when scrolled up.
- **Infinite scroll up** for history (cursor pagination, 50 per page). Group consecutive messages from the same author within 5 minutes.
- **Pinned messages** per channel (staff only).

### 5.3 Tickets (support as private threads)
Tickets are the core support feature. To the client, a ticket **looks like a private chat** with our team.

**New ticket flow** (Drawer on mobile, Dialog on desktop), 3 short steps using a step indicator:
1. **Which program?** (auto-skipped if user has only one) → `ToggleGroup` with program cards
2. **What's this about?** → category chips: Tech / CoachOS setup, Website & domain, Billing, Coaching, Something else
3. **Tell us more** → subject (`Input`), details (`Textarea`), attachments, urgency (`Select`: "Normal", "It's blocking me")
- While typing the subject, show up to 3 **suggested help articles** ("These might solve it right away"). Clicking one opens it in a Sheet without losing the draft.
- Draft is autosaved to localStorage.
- On submit: toast "Ticket #1042 opened. We usually reply within one business day." and navigate to the ticket.

**Ticket view:**
- Header: `#1042 · subject`, status `Badge`, program badge, assigned agent avatar.
- Body: chat-style message stream (same message component as channels), plus **system events** inline ("Jon picked up your ticket", "Status changed to Resolved").
- Composer at the bottom. Clients can add info anytime.
- When resolved: a small inline card "Did this solve it?" → 👍 / 👎 (+ optional comment). Client can **reopen** within 14 days by replying.

**Statuses:** `new` → `open` → `waiting_on_client` → `resolved` (→ `closed` automatically after 14 days).
**Priority:** `normal`, `high` (client-set "blocking me" = high), `urgent` (staff only).

**Help tab (mobile) / My tickets (desktop):** `Tabs` for Open / Resolved, each ticket as a row with status dot, subject, last message preview, and time.

### 5.4 Email
- **Outbound (Resend + React Email):** ticket opened (to client), new staff reply (to client), ticket resolved (to client), new ticket alert (to staff), @mention digest (to member, batched, max 1 per 30 min), magic link (via Supabase, branded template).
- **Reply-by-email:** each ticket email uses `Reply-To: ticket+{ticketId}.{signedToken}@reply.<domain>`. The inbound webhook verifies the token, strips quoted text/signatures, and posts the reply as a message from that user. Attachments are saved to Storage.
- Every email has a clear button "Open in Client Hub" deep-linking to the ticket.
- Users can control email notifications in **Me → Notifications** (`Switch` per type).

### 5.5 Inbox (notifications)
- One feed for: @mentions, replies to your threads, ticket updates.
- Unread count on the tab/sidebar. Tap to jump to the exact message (scroll + highlight).
- "Mark all as read."

### 5.6 Help center (knowledge base)
- Articles in markdown, stored in DB, editable by admins.
- Filter by program and category; search with Postgres full-text search.
- Seed with: "Connect your GoDaddy domain to your CoachOS website", "How to share a Loom video in a ticket", "Updating your billing details".
- Article footer: "Still stuck? Get help" → opens new ticket prefilled with the article's category.

### 5.7 Staff side (`/admin`)
Visible to `agent`, `admin`, `owner` roles only.
- **Ticket queue:** shadcn `DataTable` (TanStack Table) with filters: status, program, category, priority, assignee, "unassigned". Sort by oldest waiting. On mobile, render as a card list.
- **Ticket workspace:** same ticket view + right panel with client info (programs, membership status, past tickets), assign-to (`Select`), status and priority controls, **internal notes** (yellow-tinted messages only staff can see), **saved replies** (`Command` picker inserts canned text).
- **Members:** search members, see programs and Stripe status, manually grant/revoke program access (comped clients, team), send invite.
- **Channels:** create/rename/archive channels, set program and type, reorder.
- **Announcements:** post to `#announcements` with an optional "also email everyone in this program" checkbox.
- **Reports (simple):** tickets opened per week, median first response time, median resolution time, top categories, satisfaction %. Use shadcn chart components (Recharts).

### 5.8 Member profile (Me tab)
- Avatar, display name, short bio, timezone.
- Programs and membership status (read-only) + "Manage billing" link (Stripe Customer Portal).
- Notification settings, theme toggle, sign out.

---

## 6. shadcn component map

Install up front:
```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add sidebar sheet drawer dialog command popover dropdown-menu \
  context-menu hover-card tooltip avatar badge button input textarea form label select \
  toggle-group tabs scroll-area separator skeleton sonner switch card table alert \
  alert-dialog progress chart collapsible breadcrumb
```

| UI piece | Component(s) |
|---|---|
| Channel sidebar | `Sidebar`, `Collapsible` (program groups), `Badge` (unread) |
| Mobile channel list | `Sheet` (side="left") |
| Message actions | `DropdownMenu` + `ContextMenu` (desktop), `Drawer` (mobile long-press) |
| Thread panel | `Sheet` (desktop < lg), side panel (≥ lg), `Drawer` (mobile) |
| Composer | `Textarea` (auto-grow), `Button`, `Popover` (emoji + @mention) |
| Quick switcher | `Command` in `Dialog` (⌘K) |
| New ticket | `Drawer` (mobile) / `Dialog` (desktop), `Form`, `ToggleGroup`, `Select`, `Progress` for steps |
| Ticket list | `Tabs`, `Card`-less rows, `Badge` for status |
| Staff queue | `Table` + TanStack DataTable pattern |
| User hover | `HoverCard` (desktop), `Drawer` (mobile tap on avatar) |
| Confirmations | `AlertDialog` (delete message, close ticket) |
| Feedback | `sonner` toasts, `Skeleton` loading states |
| Reports | `chart` |

Build our own composed components on top of these in `components/chat/*` and `components/tickets/*`. Do not edit files in `components/ui/*` except for theme tweaks.

---

## 7. Data model (Supabase / Postgres)

Write as SQL migrations in `supabase/migrations`. Enable RLS on every table.

```sql
-- enums
create type program as enum ('alive_free', 'coachos');
create type user_role as enum ('member', 'agent', 'admin', 'owner');
create type membership_status as enum ('active', 'past_due', 'canceled', 'manual');
create type channel_type as enum ('text', 'announcement');
create type ticket_status as enum ('new', 'open', 'waiting_on_client', 'resolved', 'closed');
create type ticket_priority as enum ('normal', 'high', 'urgent');
create type ticket_category as enum ('tech', 'website_domain', 'billing', 'coaching', 'other');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  timezone text default 'America/New_York',
  role user_role not null default 'member',
  notification_prefs jsonb not null default '{}',
  created_at timestamptz default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  email text not null,                 -- lets us grant access before first login
  user_id uuid references profiles,    -- linked on first login
  program program not null,
  status membership_status not null,
  source text not null,                -- 'stripe' | 'manual' | 'ghl'
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz default now(),
  unique (email, program)
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  program program,                     -- null = shared with everyone
  type channel_type not null default 'text',
  position int not null default 0,
  archived_at timestamptz
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  number serial unique,                -- shown as #1042
  requester_id uuid not null references profiles,
  program program not null,
  category ticket_category not null,
  priority ticket_priority not null default 'normal',
  status ticket_status not null default 'new',
  subject text not null,
  assignee_id uuid references profiles,
  first_response_at timestamptz,
  resolved_at timestamptz,
  satisfaction smallint,               -- 1 = 👍, -1 = 👎
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels,
  ticket_id uuid references tickets,
  parent_id uuid references messages,  -- thread replies
  author_id uuid references profiles,  -- null for system events
  kind text not null default 'user',   -- 'user' | 'system' | 'internal_note'
  body text not null,
  attachments jsonb not null default '[]',
  via text not null default 'web',     -- 'web' | 'email'
  reply_count int not null default 0,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  check ((channel_id is null) <> (ticket_id is null))
);
create index on messages (channel_id, created_at desc);
create index on messages (ticket_id, created_at);
create index on messages (parent_id, created_at);

create table reactions (
  message_id uuid references messages on delete cascade,
  user_id uuid references profiles,
  emoji text not null,
  primary key (message_id, user_id, emoji)
);

create table read_states (
  user_id uuid references profiles,
  channel_id uuid references channels,
  ticket_id uuid references tickets,
  last_read_at timestamptz not null default now()
);
-- unique per (user, channel) and per (user, ticket) via partial unique indexes

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles,
  type text not null,                  -- 'mention' | 'thread_reply' | 'ticket_update'
  message_id uuid references messages,
  ticket_id uuid references tickets,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body_md text not null,
  program program,                     -- null = everyone
  category ticket_category,
  published boolean default false,
  search tsvector generated always as (to_tsvector('english', title || ' ' || body_md)) stored,
  updated_at timestamptz default now()
);

create table saved_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references profiles
);

create table stripe_price_map (         -- which Stripe price unlocks which program
  stripe_price_id text primary key,
  program program not null
);
```

### RLS rules (implement with helper SQL functions)
- `has_program(p program)`: true if the current user has a membership with `status in ('active','manual')` or `grace_until > now()`.
- `is_staff()`: role in (`agent`, `admin`, `owner`).
- **channels:** select if `program is null or has_program(program) or is_staff()`.
- **messages (channel):** select/insert if the user can see the channel; insert blocked for members on `announcement` channels unless `parent_id` is set (thread reply). Update/delete own only (staff can delete any).
- **messages (ticket):** select if requester or staff; `internal_note` rows are staff-only.
- **tickets:** members see/insert their own; staff see all.
- **memberships:** members read their own; only service role writes.
- **kb_articles:** published + program visible, or staff.

Triggers: update `reply_count`; bump `tickets.updated_at`; set `first_response_at` on first staff message; create `notifications` rows for mentions/thread replies/ticket updates; link `memberships.user_id` on profile creation by email.

---

## 8. Access control via Stripe

`POST /api/webhooks/stripe` (verify signature, idempotent by event id):

| Event | Action |
|---|---|
| `checkout.session.completed` | Upsert membership(s) for each price in the session → `active` |
| `customer.subscription.created` / `updated` | Map price → program; set `status`, `current_period_end` |
| `invoice.payment_failed` | `past_due`, `grace_until = now() + 3 days` |
| `customer.subscription.deleted` | `canceled` |

- One-time payments (e.g., coaching packages) grant access for a configurable period (`ACCESS_DAYS_ONE_TIME`, default 365).
- `manual` memberships (set in admin) never expire unless revoked.
- A daily cron (`/api/cron/memberships`, Vercel Cron) sweeps expired grace periods and one-time access.
- Send a welcome email with a magic-link sign-in when a new membership is created.

---

## 9. Routes

```
/login                     magic link sign-in
/auth/callback             Supabase auth callback
/access-ended              lapsed membership screen
/                          → redirect to last visited channel (or #general)
/c/[slug]                  channel
/c/[slug]/t/[messageId]    thread (deep-linkable)
/help                      my tickets + Get help
/help/new                  new ticket (renders as drawer/dialog over /help)
/help/[number]             ticket view
/kb                        help articles
/kb/[slug]                 article
/inbox                     notifications
/me                        profile & settings
/admin                     queue (staff)
/admin/tickets/[number]    staff ticket workspace
/admin/members             member management
/admin/channels            channel management
/admin/articles            KB editor
/admin/reports             reports
/api/webhooks/stripe
/api/webhooks/inbound-email
/api/cron/memberships
```

Use parallel/intercepting routes so threads and the new-ticket form open as overlays but still have shareable URLs.

---

## 10. Folder structure

```
app/
  (auth)/login, auth/callback, access-ended
  (hub)/layout.tsx          ← shell: Sidebar (desktop) / TopBar + BottomTabs (mobile)
  (hub)/c/[slug]/...
  (hub)/help/...
  (hub)/kb/...
  (hub)/inbox, me
  (admin)/admin/...
  api/webhooks/..., api/cron/...
components/
  ui/                       ← shadcn only
  shell/                    ← AppSidebar, TopBar, BottomTabs, CommandMenu
  chat/                     ← MessageList, MessageItem, MessageGroup, Composer,
                              ReactionBar, ThreadPanel, TypingIndicator, UnreadDivider,
                              MentionPopover, EmojiPicker, AttachmentPreview, MessageActions
  tickets/                  ← NewTicketFlow, TicketHeader, TicketList, StatusBadge,
                              SatisfactionPrompt, SystemEvent
  admin/                    ← QueueTable, ClientPanel, SavedReplyPicker, ReportsCharts
  kb/
emails/                     ← React Email templates
lib/
  supabase/ (server.ts, client.ts, middleware.ts)
  stripe.ts, email.ts, access.ts, markdown.ts, config.ts
hooks/
  use-realtime-channel.ts, use-typing.ts, use-presence.ts,
  use-keyboard-inset.ts, use-long-press.ts, use-media-query.ts
supabase/
  migrations/, seed.sql
```

---

## 11. Quality bar

- **Mobile:** test every screen at 360px, 390px, and 430px widths. No horizontal scroll anywhere. Composer never hidden by the keyboard (test iOS Safari behavior with `visualViewport`).
- **Accessibility:** keyboard navigable, visible focus rings, `aria-live="polite"` region for incoming messages, labeled icon buttons, color contrast AA, reduced motion respected.
- **Performance:** virtualize long message lists (`@tanstack/react-virtual`) once a channel exceeds ~200 loaded messages; lazy-load images; skeletons instead of spinners.
- **Security:** RLS on every table; service role key only in server code; verify all webhook signatures; sanitize rendered markdown; rate-limit message sends and ticket creation; signed tokens for reply-by-email.
- **Empty states:** every list has one with a clear next action (e.g., no tickets → "No open tickets. Stuck on something? Get help").
- **Errors:** friendly, specific, with a retry where it makes sense.
- **Types:** generate Supabase types (`supabase gen types typescript`) and use them everywhere. No `any`.
- **Tests:** Vitest for lib functions (access logic, email parsing, markdown); Playwright for the critical flows (login, send message, open ticket, staff reply, reply-by-email).

---

## 12. Build phases & acceptance criteria

**Phase 1: Foundation**
- Next.js + TS + Tailwind + shadcn initialized; theme tokens from §3; Figtree font; dark mode.
- Supabase project wired; migrations for all tables + RLS; seed channels, 2 test members (one per program), 1 member with both, 1 agent, 1 owner.
- Magic-link login with membership gate; middleware; `/access-ended`.
- ✅ Only seeded emails can sign in; a CoachOS-only member cannot see Alive & Free channels.

**Phase 2: Chat shell & channels**
- Responsive shell: Sidebar (desktop), TopBar + channel Sheet + BottomTabs (mobile).
- Message list with grouping, infinite scroll, composer, markdown-lite, optimistic send, realtime, unread tracking, reactions, edit/delete, attachments.
- ✅ Two browsers see each other's messages instantly; composer stays above the keyboard on a phone; unread badges clear on read.

**Phase 3: Threads, mentions, inbox, search**
- Thread panel/drawer, @mentions, notifications feed, typing indicators, presence dots, ⌘K command menu.
- ✅ Mentioning a user creates an Inbox item that deep-links to the highlighted message.

**Phase 4: Tickets**
- New-ticket 3-step flow with KB suggestions and autosaved drafts; ticket view; statuses; system events; satisfaction prompt; reopen.
- ✅ Member opens a ticket on mobile in under 30 seconds; staff sees it in the queue immediately.

**Phase 5: Staff admin + email**
- Admin queue, ticket workspace, internal notes, saved replies, member management, channel management, KB editor, reports.
- Resend templates; reply-by-email inbound webhook.
- ✅ Staff reply triggers an email; replying to that email adds a message to the ticket; internal notes never appear to members.

**Phase 6: Stripe access + polish**
- Stripe webhook + price map + cron; Customer Portal link; welcome email.
- Optional GoHighLevel sync: on membership change, call a GHL inbound webhook to add/remove tags (`hub-coachos`, `hub-alive-free`); accept a GHL webhook to grant manual access for payments made outside Stripe.
- Accessibility + performance pass; Playwright tests green.
- ✅ Using Stripe test mode: paying grants access within seconds; canceling removes it after the grace period.

---

## 13. Environment variables

```
NEXT_PUBLIC_APP_NAME="Client Hub"
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
EMAIL_FROM="Client Hub <support@yourdomain.com>"
INBOUND_EMAIL_DOMAIN=reply.yourdomain.com
INBOUND_WEBHOOK_SECRET=
REPLY_TOKEN_SECRET=
STAFF_ALERT_EMAIL=CoachOS@AliveAndFreeConsulting.com
ACCESS_DAYS_ONE_TIME=365
GRACE_DAYS=3
CRON_SECRET=
GHL_WEBHOOK_URL=            # optional
GHL_INBOUND_SECRET=         # optional
```

Create `.env.example` with these keys. Never commit real values.

---

## 14. Working rules for Claude Code

- Before each phase, write a short plan (files to create/change) and then build.
- Keep components small; co-locate server actions with the route that uses them.
- After UI work, start the dev server and check the screen at 390px and 1280px.
- Prefer Server Components; add `"use client"` only where interaction or realtime needs it.
- Don't add new dependencies beyond §2 without saying why.
- **Ask the owner before deciding:** final domain/subdomain, promised response time, which Stripe price IDs map to which program, whether members can DM each other (default: **no** — members only talk in channels and tickets), and whether the two programs should ever be split into separate portals.

@AGENTS.md
