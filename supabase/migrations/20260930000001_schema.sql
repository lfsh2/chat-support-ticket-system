-- Client Hub schema (CLAUDE.md §7)

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
  email text not null,
  user_id uuid references profiles on delete set null,
  program program not null,
  status membership_status not null,
  source text not null check (source in ('stripe', 'manual', 'ghl')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz default now(),
  unique (email, program)
);
create index on memberships (user_id);
create index on memberships (lower(email));

create table channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  program program,
  type channel_type not null default 'text',
  position int not null default 0,
  archived_at timestamptz
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  number serial unique,
  requester_id uuid not null references profiles,
  program program not null,
  category ticket_category not null,
  priority ticket_priority not null default 'normal',
  status ticket_status not null default 'new',
  subject text not null,
  assignee_id uuid references profiles,
  first_response_at timestamptz,
  resolved_at timestamptz,
  satisfaction smallint check (satisfaction in (-1, 1)),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Ticket numbers start at #1001 so they read like real ticket numbers.
alter sequence tickets_number_seq restart with 1001;
create index on tickets (requester_id, updated_at desc);
create index on tickets (status, created_at);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels,
  ticket_id uuid references tickets,
  parent_id uuid references messages,
  author_id uuid references profiles,
  kind text not null default 'user' check (kind in ('user', 'system', 'internal_note')),
  body text not null,
  attachments jsonb not null default '[]',
  via text not null default 'web' check (via in ('web', 'email')),
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
  user_id uuid references profiles on delete cascade,
  emoji text not null,
  primary key (message_id, user_id, emoji)
);

create table read_states (
  user_id uuid not null references profiles on delete cascade,
  channel_id uuid references channels on delete cascade,
  ticket_id uuid references tickets on delete cascade,
  last_read_at timestamptz not null default now(),
  check ((channel_id is null) <> (ticket_id is null))
);
create unique index read_states_user_channel on read_states (user_id, channel_id) where channel_id is not null;
create unique index read_states_user_ticket on read_states (user_id, ticket_id) where ticket_id is not null;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  type text not null check (type in ('mention', 'thread_reply', 'ticket_update')),
  message_id uuid references messages on delete cascade,
  ticket_id uuid references tickets on delete cascade,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index on notifications (user_id, created_at desc);

create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  body_md text not null,
  program program,
  category ticket_category,
  published boolean default false,
  search tsvector generated always as (to_tsvector('english', title || ' ' || body_md)) stored,
  updated_at timestamptz default now()
);
create index on kb_articles using gin (search);

create table saved_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references profiles on delete set null
);

create table stripe_price_map (
  stripe_price_id text primary key,
  program program not null
);
