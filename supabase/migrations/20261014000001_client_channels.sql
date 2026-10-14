-- Client channels: one private sub-channel per client, nested under the program's
-- main channel (#coachos-help for CoachOS, #community for Alive & Free). Only that
-- client and the team can see it. Created automatically when a client gets access.

alter table channels
  add column parent_id uuid references channels on delete cascade,
  add column client_id uuid references profiles on delete cascade;

alter table channels add constraint channels_client_shape
  check (client_id is null or (parent_id is not null and program is not null));

create unique index channels_one_per_client on channels (client_id, program) where client_id is not null;
create index on channels (parent_id);

-- "Casey Morgan" → "casey-morgan" (channel names read like Slack's).
create or replace function public.slugify(t text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(trim(both '-' from lower(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'client')
$$;

-- Which channel a program's client channels hang under.
create or replace function public.client_channel_parent(p public.program)
returns text language sql immutable set search_path = '' as $$
  select case p when 'coachos' then 'coachos-help' else 'community' end
$$;

-- Make sure a client has their private channel for a program (no-op for staff or if it exists).
create or replace function public.ensure_client_channel(uid uuid, p public.program)
returns void language plpgsql security definer set search_path = '' as $$
declare
  who public.profiles;
  parent public.channels;
begin
  select * into who from public.profiles where id = uid;
  if who.id is null or who.role <> 'member' then
    return;
  end if;
  select * into parent from public.channels
  where slug = public.client_channel_parent(p) and client_id is null;
  if parent.id is null then
    return;
  end if;

  insert into public.channels (slug, name, description, program, type, position, parent_id, client_id)
  values (
    -- Opaque, stable URL: no client name in links people might forward.
    'client-' || substr(md5(uid::text || ':' || p::text), 1, 10),
    public.slugify(who.display_name),
    'Private: ' || who.display_name || ' and the team',
    p, 'text', parent.position, parent.id, uid
  )
  on conflict (client_id, program) where client_id is not null do nothing;
end;
$$;

-- A membership that grants access (new, re-activated, or linked on first sign-in) → their channel.
create or replace function public.membership_client_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and (new.status in ('active', 'manual') or new.grace_until > now()) then
    perform public.ensure_client_channel(new.user_id, new.program);
  end if;
  return new;
end;
$$;
create trigger memberships_client_channel
  after insert or update of status, user_id, grace_until on memberships
  for each row execute function public.membership_client_channel();

-- Someone moved from the team back to member → channels for the programs they hold.
create or replace function public.role_client_channels()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'member' and old.role <> 'member' then
    perform public.ensure_client_channel(new.id, m.program)
    from public.memberships m
    where m.user_id = new.id and (m.status in ('active', 'manual') or m.grace_until > now());
  end if;
  return new;
end;
$$;
create trigger profiles_role_client_channels
  after update of role on profiles
  for each row execute function public.role_client_channels();

-- A client's display name changes → their channel follows, unless staff renamed it by hand.
create or replace function public.rename_client_channels()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.channels
  set name = public.slugify(new.display_name),
      description = 'Private: ' || new.display_name || ' and the team'
  where client_id = new.id and name = public.slugify(old.display_name);
  return new;
end;
$$;
create trigger profiles_rename_client_channels
  after update of display_name on profiles
  for each row when (new.display_name is distinct from old.display_name)
  execute function public.rename_client_channels();

-- Visibility: a client channel is for its client (while they hold that program) and staff.
-- Every message, reaction and attachment rule goes through this function.
create or replace function public.can_see_channel(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    where c.id = cid
      and (
        public.is_staff()
        or (c.archived_at is null and (
              (c.client_id is null
                and ((c.program is null and public.has_any_access()) or public.has_program(c.program)))
           or (c.client_id = auth.uid() and public.has_program(c.program))
        ))
      )
  )
$$;

-- Existing clients get their channels now.
select public.ensure_client_channel(m.user_id, m.program)
from public.memberships m
where m.user_id is not null and (m.status in ('active', 'manual') or m.grace_until > now());
