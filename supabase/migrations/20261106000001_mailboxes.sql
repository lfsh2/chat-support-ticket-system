-- Several mailboxes (coachos@, support@, …), each feeding its own team-only channel.
-- * A connection belongs to a channel; new client emails open tickets in that channel's program.
-- * Threads and the inbound log remember which mailbox they came through, so replies go out
--   from the address the client wrote to.

alter table mail_connections
  add column channel_id uuid references channels on delete set null,
  add column program public.program;
create unique index mail_connections_channel on mail_connections (channel_id) where channel_id is not null;

-- The mailbox connected so far is CoachOS's, feeding #coachos-email-ticket.
update mail_connections set
  channel_id = (select id from public.channels where slug = 'coachos-email-ticket'),
  program = 'coachos'
where channel_id is null;

alter table mail_threads add column mailbox text;
alter table inbound_emails add column mailbox text;
update mail_threads set mailbox = coalesce(
  (select email from public.mail_connections where program = 'coachos' order by connected_at limit 1),
  'coachos@aliveandfreeconsulting.com')
where mailbox is null;
update inbound_emails set mailbox = coalesce(
  (select email from public.mail_connections where program = 'coachos' order by connected_at limit 1),
  'coachos@aliveandfreeconsulting.com')
where mailbox is null;

-- What staff may see about each connection (never the token). Oldest first, so code that
-- reads only the first row still sees the CoachOS mailbox.
drop function if exists public.mail_connection_status();
create function public.mail_connection_status()
returns table (
  email text,
  channel_id uuid,
  program public.program,
  connected_at timestamptz,
  last_synced_at timestamptz,
  last_error text
)
language sql stable security definer set search_path = '' as $$
  select c.email, c.channel_id, c.program, c.connected_at, c.last_synced_at, c.last_error
  from public.mail_connections c
  where public.is_staff()
  order by c.connected_at
$$;
revoke execute on function public.mail_connection_status() from public, anon;
grant execute on function public.mail_connection_status() to authenticated;
