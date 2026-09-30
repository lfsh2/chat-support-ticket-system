-- Triggers (CLAUDE.md §7 "Triggers")

-- New auth user → profile, and link any memberships bought with that email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  update public.memberships set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Memberships granted after the user already exists (Stripe, admin) link immediately.
create or replace function public.link_membership_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(new.email);
  if new.user_id is null then
    select id into new.user_id from public.profiles where email = new.email;
  end if;
  return new;
end;
$$;
create trigger memberships_link_user
  before insert or update of email on memberships
  for each row execute function public.link_membership_user();

-- Thread reply counts.
create or replace function public.bump_reply_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null then
    update public.messages set reply_count = reply_count + 1 where id = new.parent_id;
  end if;
  return new;
end;
$$;
create trigger messages_reply_count
  after insert on messages
  for each row execute function public.bump_reply_count();

-- Ticket activity: bump updated_at, stamp first staff response.
create or replace function public.touch_ticket()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  author_is_staff boolean;
begin
  if new.ticket_id is null then
    return new;
  end if;

  select role in ('agent', 'admin', 'owner') into author_is_staff
  from public.profiles where id = new.author_id;

  update public.tickets set
    updated_at = now(),
    first_response_at = case
      when first_response_at is null and new.kind = 'user' and coalesce(author_is_staff, false)
      then now() else first_response_at end
  where id = new.ticket_id;
  return new;
end;
$$;
create trigger messages_touch_ticket
  after insert on messages
  for each row execute function public.touch_ticket();

-- Notifications for mentions, thread replies and ticket updates.
-- Mentions are stored in message bodies as @[Name](user:<uuid>).
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
  author_is_staff boolean;
begin
  if new.kind = 'system' then
    return new;
  end if;

  -- @mentions (only people who can see the message)
  insert into public.notifications (user_id, type, message_id, ticket_id)
  select distinct u.id, 'mention', new.id, new.ticket_id
  from regexp_matches(new.body, '\(user:([0-9a-f-]{36})\)', 'g') as mm(ids)
  join public.profiles u on u.id = mm.ids[1]::uuid
  where u.id is distinct from new.author_id
    and (new.kind <> 'internal_note' or u.role in ('agent', 'admin', 'owner'));

  -- Thread replies → parent author and earlier repliers
  if new.parent_id is not null then
    insert into public.notifications (user_id, type, message_id, ticket_id)
    select distinct x.uid, 'thread_reply', new.id, new.ticket_id
    from (
      select author_id as uid from public.messages where id = new.parent_id
      union
      select author_id from public.messages where parent_id = new.parent_id
    ) x
    where x.uid is not null and x.uid is distinct from new.author_id
      and not exists (
        select 1 from public.notifications n
        where n.message_id = new.id and n.user_id = x.uid
      );
  end if;

  -- Ticket updates: staff reply → requester; requester reply → assignee
  if new.ticket_id is not null and new.kind = 'user' then
    select * into t from public.tickets where id = new.ticket_id;
    select role in ('agent', 'admin', 'owner') into author_is_staff
    from public.profiles where id = new.author_id;

    if coalesce(author_is_staff, false) and t.requester_id is distinct from new.author_id then
      insert into public.notifications (user_id, type, message_id, ticket_id)
      values (t.requester_id, 'ticket_update', new.id, t.id);
    elsif new.author_id = t.requester_id and t.assignee_id is not null then
      insert into public.notifications (user_id, type, message_id, ticket_id)
      values (t.assignee_id, 'ticket_update', new.id, t.id);
    end if;
  end if;

  return new;
end;
$$;
create trigger messages_notify
  after insert on messages
  for each row execute function public.notify_on_message();

-- Keep kb_articles.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger kb_articles_touch before update on kb_articles
  for each row execute function public.touch_updated_at();

-- Realtime: stream data changes to clients (RLS still applies).
alter publication supabase_realtime add table messages, reactions, notifications, tickets;
