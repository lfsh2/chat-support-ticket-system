-- CoachOS email inbox: coachos@ Gmail ↔ tickets, with a team-only #coachos-email-ticket feed.
-- Inbound: a sync job reads the Gmail inbox and turns client emails into tickets (or appends
-- to the ticket a thread belongs to); every email gets a card in the feed.
-- Outbound: a team reply on a ticket is queued in email_outbox and sent from coachos@.

-- ---- Team-only channels -------------------------------------------------------------

alter table channels add column staff_only boolean not null default false;

create or replace function public.can_see_channel(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    where c.id = cid
      and (
        public.is_staff()
        or (not c.staff_only and c.archived_at is null and (
              (c.client_id is null
                and ((c.program is null and public.has_any_access()) or public.has_program(c.program)))
           or (c.client_id = auth.uid() and public.has_program(c.program))
        ))
      )
  )
$$;

insert into channels (slug, name, description, program, type, position, staff_only)
values ('coachos-email-ticket', 'coachos-email-ticket', 'New emails to CoachOS@ · team only', 'coachos', 'text', 13, true)
on conflict (slug) do nothing;

-- ---- Messages and tickets know about email ------------------------------------------

-- 'email' = a card in the feed; its details live in `meta` (written by the server only).
alter table messages drop constraint messages_kind_check;
alter table messages add constraint messages_kind_check
  check (kind in ('user', 'system', 'internal_note', 'email'));
alter table messages add column meta jsonb;

alter table tickets add column source text not null default 'web' check (source in ('web', 'email'));

-- A client emailing several times an hour must not bounce off the web form's rate limit.
create or replace function public.limit_ticket_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'email' then
    return new;
  end if;
  if (
    select count(*) from public.tickets
    where requester_id = new.requester_id and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'You''ve opened a few tickets in the last hour. Add details to an open ticket, or try again a little later.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

-- ---- Mailbox connection (service role only: holds the encrypted refresh token) -------

create table mail_connections (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  provider text not null default 'gmail' check (provider in ('gmail')),
  refresh_token_enc text not null,
  history_id text,
  connected_by uuid references profiles on delete set null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text,
  sync_started_at timestamptz -- set while a sync runs, so two never overlap
);
alter table mail_connections enable row level security; -- no policies: server only

-- What staff may see about the connection (never the token).
create or replace function public.mail_connection_status()
returns table (email text, connected_at timestamptz, last_synced_at timestamptz, last_error text)
language sql stable security definer set search_path = '' as $$
  select c.email, c.connected_at, c.last_synced_at, c.last_error
  from public.mail_connections c
  where public.is_staff()
  order by c.connected_at desc
  limit 1
$$;

-- ---- Inbound log, thread map, outbox (server-written) --------------------------------

create table inbound_emails (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text unique not null,
  gmail_thread_id text not null,
  message_id_header text,
  from_email text not null,
  from_name text,
  subject text,
  body_text text,
  received_at timestamptz,
  status text not null check (status in ('ticket', 'appended', 'unmatched', 'ignored', 'handled', 'mirrored')),
  ignore_reason text,
  ticket_id uuid references tickets on delete set null,
  hub_message_id uuid references messages on delete set null,
  created_at timestamptz not null default now()
);
create index on inbound_emails (gmail_thread_id);
create index on inbound_emails (created_at desc);
alter table inbound_emails enable row level security;
create policy "inbound_emails: staff read" on inbound_emails for select to authenticated using (public.is_staff());

-- Which Gmail thread carries which ticket's conversation.
create table mail_threads (
  gmail_thread_id text primary key,
  ticket_id uuid unique not null references tickets on delete cascade,
  subject text not null,
  last_message_id_header text,
  created_at timestamptz not null default now()
);
alter table mail_threads enable row level security; -- server only

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets on delete cascade,
  message_id uuid unique references messages on delete cascade,
  kind text not null check (kind in ('reply', 'resolved')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  gmail_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index on email_outbox (status, created_at);
alter table email_outbox enable row level security; -- server only

-- A team reply typed in the hub → email it to the client. Only while a mailbox is connected,
-- so connecting Gmail later never sends a backlog of old replies.
create or replace function public.enqueue_ticket_reply_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.ticket_id is not null and new.kind = 'user' and new.via = 'web'
     and exists (select 1 from public.mail_connections) and exists (
    select 1 from public.profiles p where p.id = new.author_id and p.role in ('agent', 'admin', 'owner')
  ) then
    insert into public.email_outbox (ticket_id, message_id, kind) values (new.ticket_id, new.id, 'reply');
  end if;
  return new;
end;
$$;
create trigger messages_enqueue_email
  after insert on messages
  for each row execute function public.enqueue_ticket_reply_email();

-- A ticket marked resolved → tell the client by email.
create or replace function public.enqueue_ticket_resolved_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved'
     and exists (select 1 from public.mail_connections) then
    insert into public.email_outbox (ticket_id, kind) values (new.id, 'resolved');
  end if;
  return new;
end;
$$;
create trigger tickets_enqueue_resolved_email
  after update of status on tickets
  for each row execute function public.enqueue_ticket_resolved_email();

-- ---- The every-minute sync runs from Supabase (scheduled per environment; see supabase/mail-cron.sql)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
