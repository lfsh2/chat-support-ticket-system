-- Phase 2: chat support (unread tracking, send limits, soft delete, realtime, attachments)

-- Realtime needs full rows on UPDATE/DELETE to patch client caches.
alter table messages replica identity full;
alter table reactions replica identity full;

-- Mark a channel read for the current user.
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
end;
$$;

-- Unread top-level messages from other people, per visible channel.
create or replace function public.channel_unread_counts()
returns table (channel_id uuid, unread int)
language sql stable security invoker set search_path = '' as $$
  select c.id, count(m.id)::int
  from public.channels c
  left join public.read_states rs
    on rs.channel_id = c.id and rs.user_id = auth.uid()
  left join public.messages m
    on m.channel_id = c.id
   and m.parent_id is null
   and m.deleted_at is null
   and m.author_id is distinct from auth.uid()
   and m.created_at > coalesce(rs.last_read_at, '-infinity')
  where c.archived_at is null
  group by c.id
$$;

-- Rate limit: at most 20 messages per user per minute (§11 security).
create or replace function public.limit_message_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.author_id is not null and new.kind = 'user' and (
    select count(*) from public.messages
    where author_id = new.author_id and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'You''re sending messages very quickly. Please wait a moment and try again.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger messages_rate_limit
  before insert on messages
  for each row execute function public.limit_message_rate();

-- Soft delete wipes the content so it can't be read back through the API.
create or replace function public.scrub_deleted_message()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.body := '';
    new.attachments := '[]';
  elsif old.deleted_at is not null then
    new.deleted_at := old.deleted_at;  -- deletes are final
    new.body := old.body;
  end if;
  if new.body is distinct from old.body and new.deleted_at is null then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger messages_scrub_deleted
  before update on messages
  for each row execute function public.scrub_deleted_message();

-- Attachments: private bucket, 10 MB. Channel files live at channels/<channel_id>/<user_id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do nothing;

create policy "attachments: upload to visible channel" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'channels'
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.can_see_channel(((storage.foldername(name))[2])::uuid)
  );

create policy "attachments: read visible channel" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'channels'
    and public.can_see_channel(((storage.foldername(name))[2])::uuid)
  );
