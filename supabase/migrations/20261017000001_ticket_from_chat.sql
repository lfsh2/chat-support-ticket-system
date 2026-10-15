-- Turn a chat message into a ticket: the team can open a ticket for a client straight
-- from a message in their channel. The ticket is marked source 'chat'; its first message
-- (a copy of the chat message) is via 'chat', so it is never emailed back to the client.

alter table tickets drop constraint tickets_source_check;
alter table tickets add constraint tickets_source_check check (source in ('web', 'email', 'chat'));

alter table messages drop constraint messages_via_check;
alter table messages add constraint messages_via_check check (via in ('web', 'email', 'chat'));

-- Only the client-facing web form is rate limited; email and team-made tickets are not.
create or replace function public.limit_ticket_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source <> 'web' then
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
