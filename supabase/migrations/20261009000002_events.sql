-- Dashboard calendar: team events (live Q&A, workshops, office hours).
-- Members see events for everyone or for their programs; only staff create and edit.

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  program program,                     -- null = everyone
  starts_at timestamptz not null,
  ends_at timestamptz,
  link text check (link ~* '^https?://'),
  created_by uuid references profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index on events (starts_at);

alter table events enable row level security;

create policy "events: read" on events for select to authenticated
  using (
    public.is_staff()
    or (program is null and public.has_any_access())
    or public.has_program(program)
  );
create policy "events: staff write" on events for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
