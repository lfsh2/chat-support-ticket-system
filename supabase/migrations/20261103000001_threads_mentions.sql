-- Phase 3: threads, @mentions and the Inbox.
-- * One visibility rule for "can this person see this channel", used by RLS and by notifications.
-- * Thread replies must hang off a top-level message in the same channel or ticket.
-- * Notifications only go to people who can actually open the message.
-- * Mention suggestions for the composer.

-- ---- Visibility for any user (not just the caller) ----------------------------------------

create or replace function public.user_has_program(uid uuid, p public.program)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = uid and m.program = p
      and (m.status in ('active', 'manual') or m.grace_until > now())
  )
$$;

create or replace function public.user_can_see_channel(uid uuid, cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.channels c
    join public.profiles p on p.id = uid
    where c.id = cid
      and (
        p.role in ('agent', 'admin', 'owner')
        or (not c.staff_only and c.archived_at is null and (
              (c.client_id is null and (
                 (c.program is null and exists (
                    select 1 from public.memberships m
                    where m.user_id = uid and (m.status in ('active', 'manual') or m.grace_until > now())))
                 or public.user_has_program(uid, c.program)))
           or (c.client_id = uid and public.user_has_program(uid, c.program))
        ))
      )
  )
$$;

-- The caller's own check now goes through the same rule, so the two can't drift apart.
create or replace function public.can_see_channel(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.user_can_see_channel(auth.uid(), cid)
$$;

-- Can this user open this message? (Ticket messages: the requester and the team; notes: team only.)
create or replace function public.user_can_see_message(uid uuid, mid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    where m.id = mid
      and (
        (m.channel_id is not null and public.user_can_see_channel(uid, m.channel_id))
        or (m.ticket_id is not null and (
              exists (select 1 from public.profiles p where p.id = uid and p.role in ('agent', 'admin', 'owner'))
              or (m.kind <> 'internal_note'
                  and exists (select 1 from public.tickets t where t.id = m.ticket_id and t.requester_id = uid))))
      )
  )
$$;

-- ---- Threads -------------------------------------------------------------------------------

-- A reply's parent must be a top-level message in the same place (so nobody can, say, post
-- into an announcement channel by pointing parent_id at a message somewhere else).
create or replace function public.check_thread_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.messages p
    where p.id = new.parent_id
      and p.parent_id is null
      and p.deleted_at is null
      and p.kind in ('user', 'email')
      and p.channel_id is not distinct from new.channel_id
      and p.ticket_id is not distinct from new.ticket_id
  ) then
    raise exception 'That conversation is no longer available.' using errcode = '23514', hint = 'bad_parent';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_check_thread_parent on messages;
create trigger messages_check_thread_parent
  before insert on messages
  for each row execute function public.check_thread_parent();

create index if not exists notifications_user_created on notifications (user_id, created_at desc);
create index if not exists notifications_user_unread on notifications (user_id) where read_at is null;

-- ---- Notifications -------------------------------------------------------------------------

create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
  author_is_staff boolean;
begin
  select role in ('agent', 'admin', 'owner') into author_is_staff
  from public.profiles where id = new.author_id;

  -- System events on a ticket: tell the client when the team picks it up, resolves it
  -- or asks them for something. (Priority changes and "opened" are noise.)
  if new.kind = 'system' then
    if new.ticket_id is not null and coalesce(author_is_staff, false)
       and (new.body in ('picked up this ticket', 'marked this resolved', 'is waiting on a reply from the client')
            or new.body like 'assigned this ticket to %') then
      select * into t from public.tickets where id = new.ticket_id;
      if t.requester_id is distinct from new.author_id then
        insert into public.notifications (user_id, type, message_id, ticket_id)
        values (t.requester_id, 'ticket_update', new.id, t.id);
      end if;
    end if;
    return new;
  end if;
  if new.kind = 'email' then
    return new;
  end if;

  -- @mentions, only for people who can open the message.
  insert into public.notifications (user_id, type, message_id, ticket_id)
  select distinct u.id, 'mention', new.id, new.ticket_id
  from regexp_matches(new.body, '\(user:([0-9a-f-]{36})\)', 'g') as mm(ids)
  join public.profiles u on u.id = mm.ids[1]::uuid
  where u.id is distinct from new.author_id
    and public.user_can_see_message(u.id, new.id);

  -- Thread replies → the parent's author and everyone who replied before.
  if new.parent_id is not null then
    insert into public.notifications (user_id, type, message_id, ticket_id)
    select distinct x.uid, 'thread_reply', new.id, new.ticket_id
    from (
      select author_id as uid from public.messages where id = new.parent_id
      union
      select author_id from public.messages where parent_id = new.parent_id and id <> new.id
    ) x
    where x.uid is not null and x.uid is distinct from new.author_id
      and public.user_can_see_message(x.uid, new.id)
      and not exists (select 1 from public.notifications n where n.message_id = new.id and n.user_id = x.uid);
  end if;

  -- Ticket replies: the team → the client; the client → whoever is assigned.
  if new.ticket_id is not null and new.kind = 'user' and new.parent_id is null then
    select * into t from public.tickets where id = new.ticket_id;
    if coalesce(author_is_staff, false) and t.requester_id is distinct from new.author_id then
      insert into public.notifications (user_id, type, message_id, ticket_id)
      select t.requester_id, 'ticket_update', new.id, t.id
      where not exists (select 1 from public.notifications n where n.message_id = new.id and n.user_id = t.requester_id);
    elsif new.author_id = t.requester_id and t.assignee_id is not null then
      insert into public.notifications (user_id, type, message_id, ticket_id)
      select t.assignee_id, 'ticket_update', new.id, t.id
      where not exists (select 1 from public.notifications n where n.message_id = new.id and n.user_id = t.assignee_id);
    end if;
  end if;

  return new;
end;
$$;

-- ---- Mention suggestions ---------------------------------------------------------------------

-- People the caller can @mention in a channel or a ticket: everyone who can see it.
-- Returns names and avatars only (never emails).
create or replace function public.mention_candidates(cid uuid default null, tid uuid default null, notes boolean default false)
returns table (id uuid, display_name text, avatar_url text, role public.user_role)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.avatar_url, p.role
  from public.profiles p
  where p.id is distinct from auth.uid()
    and (
      (cid is not null and public.can_see_channel(cid) and public.user_can_see_channel(p.id, cid))
      or (tid is not null and public.can_see_ticket(tid) and (
            p.role in ('agent', 'admin', 'owner')
            or (not notes and exists (select 1 from public.tickets t where t.id = tid and t.requester_id = p.id))))
    )
  order by p.display_name
  limit 500
$$;

-- The per-user checks are for policies and triggers only: callers can't probe other people's access.
revoke execute on function public.user_can_see_channel(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.user_can_see_message(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.user_has_program(uuid, public.program) from public, anon, authenticated;
revoke execute on function public.mention_candidates(uuid, uuid, boolean) from public, anon;
grant execute on function public.mention_candidates(uuid, uuid, boolean) to authenticated;

-- ---- Inbox clears itself when you've seen the thing ------------------------------------------

-- Reading a channel also clears mentions of you in it (thread replies clear when the thread opens).
create or replace function public.mark_channel_read(cid uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.can_see_channel(cid) then
    raise exception 'channel not visible' using errcode = '42501';
  end if;
  insert into public.read_states (user_id, channel_id, last_read_at)
  values (auth.uid(), cid, now())
  on conflict (user_id, channel_id) where channel_id is not null
  do update set last_read_at = excluded.last_read_at;

  update public.notifications n set read_at = now()
  where n.user_id = auth.uid() and n.read_at is null
    and exists (select 1 from public.messages m where m.id = n.message_id and m.channel_id = cid and m.parent_id is null);
end;
$$;

-- Opening a ticket or a thread clears its notifications. Returns how many were cleared.
create or replace function public.clear_notifications(tid uuid default null, pid uuid default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare
  n int;
begin
  update public.notifications x set read_at = now()
  where x.user_id = auth.uid() and x.read_at is null
    and (
      (tid is not null and x.ticket_id = tid)
      or (pid is not null and exists (
            select 1 from public.messages m where m.id = x.message_id and (m.parent_id = pid or m.id = pid)))
    );
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.clear_notifications(uuid, uuid) from public, anon;
grant execute on function public.clear_notifications(uuid, uuid) to authenticated;

-- Realtime: the Inbox badge also updates when another tab marks things read.
alter table notifications replica identity full;

-- A notification goes with its message or ticket (hard deletes and cleanup no longer trip over it).
alter table notifications
  drop constraint notifications_message_id_fkey,
  add constraint notifications_message_id_fkey foreign key (message_id) references messages (id) on delete cascade;
alter table notifications
  drop constraint notifications_ticket_id_fkey,
  add constraint notifications_ticket_id_fkey foreign key (ticket_id) references tickets (id) on delete cascade;
