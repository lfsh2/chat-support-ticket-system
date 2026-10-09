-- Dashboard: ticket management + internal team task tracker

-- ---- Tickets ----------------------------------------------------------------------

-- Open a ticket and its first message in one step. Runs as the caller, so RLS applies.
create or replace function public.open_ticket(
  p_program public.program,
  p_category public.ticket_category,
  p_subject text,
  p_body text,
  p_priority public.ticket_priority default 'normal'
)
returns table (id uuid, number int)
language plpgsql security invoker set search_path = '' as $$
declare
  t public.tickets;
begin
  insert into public.tickets (requester_id, program, category, priority, subject)
  values (auth.uid(), p_program, p_category, p_priority, btrim(p_subject))
  returning * into t;

  insert into public.messages (ticket_id, author_id, body)
  values (t.id, auth.uid(), btrim(p_body));

  return query select t.id, t.number;
end;
$$;

-- Rate limit: at most 5 new tickets per person per hour (§11 security).
create or replace function public.limit_ticket_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
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
create trigger tickets_rate_limit
  before insert on tickets
  for each row execute function public.limit_ticket_rate();

alter table tickets add constraint tickets_subject_length check (char_length(subject) between 3 and 160);

-- Status bookkeeping: resolved_at follows the status; updated_at always bumps.
create or replace function public.ticket_status_stamps()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then
      new.resolved_at := now();
    elsif new.status not in ('resolved', 'closed') then
      new.resolved_at := null;
      new.satisfaction := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger tickets_status_stamps
  before update on tickets
  for each row execute function public.ticket_status_stamps();

-- System events in the ticket stream: "Jon picked up this ticket", "… marked this resolved".
-- The body is written to read after the actor's name.
create or replace function public.ticket_system_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  assignee_name text;
begin
  if new.assignee_id is distinct from old.assignee_id then
    if new.assignee_id is null then
      insert into public.messages (ticket_id, author_id, kind, body)
      values (new.id, auth.uid(), 'system', 'unassigned this ticket');
    elsif new.assignee_id = auth.uid() then
      insert into public.messages (ticket_id, author_id, kind, body)
      values (new.id, auth.uid(), 'system', 'picked up this ticket');
    else
      select display_name into assignee_name from public.profiles where id = new.assignee_id;
      insert into public.messages (ticket_id, author_id, kind, body)
      values (new.id, auth.uid(), 'system', 'assigned this ticket to ' || coalesce(assignee_name, 'a teammate'));
    end if;
  end if;

  if new.status is distinct from old.status then
    insert into public.messages (ticket_id, author_id, kind, body)
    values (new.id, auth.uid(), 'system', case new.status
      when 'open' then case when old.status in ('resolved', 'closed') then 'reopened this ticket' else 'marked this open' end
      when 'waiting_on_client' then 'is waiting on a reply from the client'
      when 'resolved' then 'marked this resolved'
      when 'closed' then 'closed this ticket'
      else 'changed the status to new'
    end);
  end if;

  if new.priority is distinct from old.priority then
    insert into public.messages (ticket_id, author_id, kind, body)
    values (new.id, auth.uid(), 'system', 'set the priority to ' || new.priority::text);
  end if;
  return new;
end;
$$;
create trigger tickets_system_events
  after update of status, assignee_id, priority on tickets
  for each row execute function public.ticket_system_events();

-- Replies move the ticket along: the client replying reopens a resolved/waiting ticket;
-- the team's first reply on a new ticket opens it.
create or replace function public.ticket_status_on_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t public.tickets;
  author_is_staff boolean;
begin
  if new.ticket_id is null or new.kind <> 'user' then
    return new;
  end if;
  select * into t from public.tickets where id = new.ticket_id;
  select role in ('agent', 'admin', 'owner') into author_is_staff from public.profiles where id = new.author_id;

  if new.author_id = t.requester_id and t.status in ('waiting_on_client', 'resolved') then
    update public.tickets set status = 'open' where id = t.id;
  elsif coalesce(author_is_staff, false) and t.status = 'new' then
    update public.tickets set status = 'open' where id = t.id;
  end if;
  return new;
end;
$$;
create trigger messages_ticket_status
  after insert on messages
  for each row execute function public.ticket_status_on_reply();

-- Members can't reply on closed tickets (they open a new one instead).
drop policy "messages: insert" on messages;
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
      or (kind = 'user' and ticket_id is not null and public.can_see_ticket(ticket_id)
          and (public.is_staff()
               or exists (select 1 from tickets t where t.id = ticket_id and t.status <> 'closed')))
      or (kind = 'internal_note' and ticket_id is not null and public.is_staff())
    )
  );

-- "Did this solve it?" — the requester rates their own resolved ticket.
create or replace function public.rate_ticket(tid uuid, score smallint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if score not in (-1, 1) then
    raise exception 'score must be -1 or 1' using errcode = '22023';
  end if;
  update public.tickets set satisfaction = score
  where id = tid and requester_id = auth.uid() and status in ('resolved', 'closed');
  if not found then
    raise exception 'ticket not found' using errcode = '42501';
  end if;
end;
$$;

-- Ticket attachments live at tickets/<ticket_id>/<user_id>/<file>.
create policy "attachments: upload to visible ticket" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'tickets'
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.can_see_ticket(((storage.foldername(name))[2])::uuid)
  );
create policy "attachments: read visible ticket" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'tickets'
    and public.can_see_ticket(((storage.foldername(name))[2])::uuid)
  );

alter table tickets replica identity full;

-- ---- Tasks (internal, staff only) ---------------------------------------------------

create type task_status as enum ('todo', 'in_progress', 'done');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  notes text,
  status task_status not null default 'todo',
  priority ticket_priority not null default 'normal',
  assignee_id uuid references profiles on delete set null,
  created_by uuid references profiles on delete set null default auth.uid(),
  ticket_id uuid references tickets on delete set null,
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tasks (status, due_on);
create index on tasks (assignee_id) where status <> 'done';
create index on tasks (ticket_id);

alter table tasks enable row level security;
create policy "tasks: staff" on tasks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create or replace function public.task_stamps()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_stamps
  before insert or update on tasks
  for each row execute function public.task_stamps();

alter table tasks replica identity full;
alter publication supabase_realtime add table tasks;
