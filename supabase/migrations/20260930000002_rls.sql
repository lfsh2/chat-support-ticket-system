-- Row Level Security (CLAUDE.md §7 "RLS rules")
-- Helpers are SECURITY DEFINER so policies can call them without recursing through RLS.

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('agent', 'admin', 'owner')
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'owner')
  )
$$;

create or replace function public.has_program(p public.program)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.program = p
      and (m.status in ('active', 'manual') or m.grace_until > now())
  )
$$;

-- True if the current user may be in the hub at all (any live program, or staff).
create or replace function public.has_any_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() or exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and (m.status in ('active', 'manual') or m.grace_until > now())
  )
$$;

create or replace function public.can_see_channel(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    where c.id = cid
      and (
        public.is_staff()
        or (c.archived_at is null
            and ((c.program is null and public.has_any_access()) or public.has_program(c.program)))
      )
  )
$$;

create or replace function public.can_see_ticket(tid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() or exists (
    select 1 from public.tickets t where t.id = tid and t.requester_id = auth.uid()
  )
$$;

create or replace function public.can_see_message(mid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    where m.id = mid
      and (
        (m.channel_id is not null and public.can_see_channel(m.channel_id))
        or (m.ticket_id is not null and public.can_see_ticket(m.ticket_id)
            and (m.kind <> 'internal_note' or public.is_staff()))
      )
  )
$$;

alter table profiles enable row level security;
alter table memberships enable row level security;
alter table channels enable row level security;
alter table tickets enable row level security;
alter table messages enable row level security;
alter table reactions enable row level security;
alter table read_states enable row level security;
alter table notifications enable row level security;
alter table kb_articles enable row level security;
alter table saved_replies enable row level security;
alter table stripe_price_map enable row level security;

-- profiles: hub members can see each other (names/avatars in chat); edit own safe columns only.
create policy "profiles: read" on profiles for select to authenticated
  using (id = auth.uid() or public.has_any_access());
create policy "profiles: update own" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (display_name, avatar_url, bio, timezone, notification_prefs) on profiles to authenticated;

-- memberships: read own; only the service role writes.
create policy "memberships: read own" on memberships for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- channels
create policy "channels: read visible" on channels for select to authenticated
  using (public.can_see_channel(id));
create policy "channels: admin write" on channels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tickets: members see/insert their own; staff see and manage all.
create policy "tickets: read" on tickets for select to authenticated
  using (requester_id = auth.uid() or public.is_staff());
create policy "tickets: member insert" on tickets for insert to authenticated
  with check (
    requester_id = auth.uid()
    and (public.has_program(program) or public.is_staff())
    and status = 'new'
    and priority in ('normal', 'high')
    and assignee_id is null
  );
create policy "tickets: staff update" on tickets for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- messages
create policy "messages: read" on messages for select to authenticated
  using (
    (channel_id is not null and public.can_see_channel(channel_id))
    or (ticket_id is not null and public.can_see_ticket(ticket_id)
        and (kind <> 'internal_note' or public.is_staff()))
  );
create policy "messages: insert" on messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (kind = 'user'
        and channel_id is not null
        and public.can_see_channel(channel_id)
        and (
          public.is_staff()
          or parent_id is not null
          or not exists (select 1 from channels c where c.id = channel_id and c.type = 'announcement')
        ))
      or (kind = 'user' and ticket_id is not null and public.can_see_ticket(ticket_id))
      or (kind = 'internal_note' and ticket_id is not null and public.is_staff())
    )
  );
-- Edits and soft deletes: own messages, or any message for staff.
create policy "messages: update" on messages for update to authenticated
  using (author_id = auth.uid() or public.is_staff())
  with check (author_id = auth.uid() or public.is_staff());
revoke update on messages from authenticated;
grant update (body, edited_at, deleted_at) on messages to authenticated;
create policy "messages: staff hard delete" on messages for delete to authenticated
  using (public.is_staff());

-- reactions
create policy "reactions: read" on reactions for select to authenticated
  using (public.can_see_message(message_id));
create policy "reactions: add own" on reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_message(message_id));
create policy "reactions: remove own" on reactions for delete to authenticated
  using (user_id = auth.uid());

-- read_states: own rows only.
create policy "read_states: own" on read_states for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications: created by triggers; users read and mark their own.
create policy "notifications: read own" on notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications: mark own" on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

-- kb_articles
create policy "kb: read" on kb_articles for select to authenticated
  using (
    public.is_staff()
    or (published and ((program is null and public.has_any_access()) or public.has_program(program)))
  );
create policy "kb: admin write" on kb_articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- saved_replies: staff only.
create policy "saved_replies: staff" on saved_replies for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- stripe_price_map: staff can read; service role writes.
create policy "price_map: staff read" on stripe_price_map for select to authenticated
  using (public.is_staff());
