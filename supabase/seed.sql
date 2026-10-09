-- Local/dev seed (CLAUDE.md §12 Phase 1). Magic links land in the local Mailpit inbox.

-- Channels
insert into channels (slug, name, description, program, type, position) values
  ('announcements',    'announcements',    'News from the team',                       null,         'announcement', 0),
  ('general',          'general',          'Say hi and chat with everyone',            null,         'text',         1),
  ('wins',             'wins',             'Share your wins, big and small',           null,         'text',         2),
  ('coachos-help',     'coachos-help',     'Questions about using CoachOS',            'coachos',    'text',         10),
  ('tech-setup',       'tech-setup',       'Domains, email and integrations',          'coachos',    'text',         11),
  ('feature-requests', 'feature-requests', 'Ideas to make CoachOS better',             'coachos',    'text',         12),
  ('community',        'community',        'The Alive & Free community',               'alive_free', 'text',         20),
  ('resources',        'resources',        'Worksheets, recordings and links',         'alive_free', 'text',         21);

-- Test users (profiles are created by the on_auth_user_created trigger)
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'coachos@example.com',   'Casey CoachOS'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'alivefree@example.com', 'Alex AliveFree'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'both@example.com',      'Bailey Both'),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'agent@example.com',     'Jon (Support)'),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'owner@example.com',     'Sammi (Owner)'),
      ('00000000-0000-4000-a000-000000000006'::uuid, 'lapsed@example.com',    'Lee Lapsed')
    ) as t(id, email, display_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.display_name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end $$;

update profiles set role = 'agent' where email = 'agent@example.com';
update profiles set role = 'owner' where email = 'owner@example.com';

-- Memberships (user_id is linked by trigger)
insert into memberships (email, program, status, source) values
  ('coachos@example.com',   'coachos',    'active',   'stripe'),
  ('alivefree@example.com', 'alive_free', 'active',   'stripe'),
  ('both@example.com',      'coachos',    'active',   'stripe'),
  ('both@example.com',      'alive_free', 'manual',   'manual'),
  ('lapsed@example.com',    'coachos',    'canceled', 'stripe');

-- Help articles
insert into kb_articles (slug, title, body_md, program, category, published) values
  ('connect-godaddy-domain', 'Connect your GoDaddy domain to your CoachOS website',
   E'1. Sign in to GoDaddy and open **My Products → DNS** for your domain.\n2. Add a **CNAME** record: name `www`, value from **CoachOS → Settings → Domains**.\n3. Back in CoachOS, click **Verify**. Changes can take up to an hour.\n\nStill not working? Open a ticket and include a screenshot of your DNS page.',
   'coachos', 'website_domain', true),
  ('share-loom-video', 'How to share a Loom video in a ticket',
   E'A quick video is often the fastest way to show us a problem.\n\n1. Record with [Loom](https://www.loom.com).\n2. Click **Share → Copy link**.\n3. Paste the link into your ticket message.',
   null, 'tech', true),
  ('update-billing-details', 'Updating your billing details',
   E'Go to **Me → Manage billing**. You can update your card, see invoices, and change your plan there.',
   null, 'billing', true);

-- A welcome message so channels aren't empty
insert into messages (channel_id, author_id, body)
select id, '00000000-0000-4000-a000-000000000005', 'Welcome to the Client Hub! Say hi and let us know how we can help. 👋'
from channels where slug in ('announcements', 'general');

-- Sample tickets and team tasks. Triggers are off for this block so the backdated
-- timestamps and statuses stay exactly as written (no reopen-on-reply, no system events).
set session_replication_role = replica;
do $$
declare
  casey constant uuid := '00000000-0000-4000-a000-000000000001';
  alex  constant uuid := '00000000-0000-4000-a000-000000000002';
  bailey constant uuid := '00000000-0000-4000-a000-000000000003';
  jon   constant uuid := '00000000-0000-4000-a000-000000000004';
  t1 uuid; t2 uuid; t3 uuid;
begin
  insert into tickets (requester_id, program, category, priority, status, subject, assignee_id, created_at, updated_at, first_response_at)
  values (casey, 'coachos', 'website_domain', 'high', 'open', 'My domain still says pending verification', jon,
          now() - interval '5 hours', now() - interval '2 hours', now() - interval '4 hours')
  returning id into t1;
  insert into messages (ticket_id, author_id, body, created_at) values
    (t1, casey, 'I added the CNAME record yesterday but CoachOS still says **pending verification**. Is something wrong?', now() - interval '5 hours'),
    (t1, jon, 'Thanks Casey — I''m taking a look now. Could you send a screenshot of your DNS page in GoDaddy?', now() - interval '4 hours'),
    (t1, casey, 'Sure, here you go. The record is `www` → the value from Settings.', now() - interval '2 hours');
  insert into messages (ticket_id, author_id, kind, body, created_at) values
    (t1, jon, 'internal_note', 'Their CNAME has a trailing dot missing. Will walk them through it.', now() - interval '110 minutes');

  insert into tickets (requester_id, program, category, status, subject, created_at, updated_at)
  values (alex, 'alive_free', 'billing', 'new', 'Can I switch to the annual plan?', now() - interval '50 minutes', now() - interval '50 minutes')
  returning id into t2;
  insert into messages (ticket_id, author_id, body, created_at)
  values (t2, alex, 'I''d like to move to annual billing to save a bit. How do I do that?', now() - interval '50 minutes');

  insert into tickets (requester_id, program, category, status, subject, assignee_id, created_at, updated_at, resolved_at, first_response_at)
  values (bailey, 'coachos', 'tech', 'resolved', 'Calendar not syncing with booking page', jon,
          now() - interval '3 days', now() - interval '2 days', now() - interval '2 days', now() - interval '3 days')
  returning id into t3;
  insert into messages (ticket_id, author_id, body, created_at) values
    (t3, bailey, 'New bookings aren''t showing on my Google Calendar.', now() - interval '3 days'),
    (t3, jon, 'Reconnect it under **Settings → Integrations → Calendar** and it should catch up within a minute.', now() - interval '3 days' + interval '20 minutes'),
    (t3, bailey, 'That fixed it, thanks!', now() - interval '2 days');

  -- Team tasks
  insert into tasks (title, notes, status, priority, assignee_id, created_by, ticket_id, due_on) values
    ('Walk Casey through the CNAME fix', 'Record a short Loom showing the trailing-dot issue.', 'in_progress', 'high', jon, jon, t1, current_date),
    ('Reply to Alex about annual billing', null, 'todo', 'normal', null, jon, t2, current_date + 1),
    ('Write KB article: calendar sync troubleshooting', 'Based on Bailey''s ticket.', 'todo', 'normal', jon, jon, t3, current_date + 5),
    ('Prep Thursday Q&A questions', null, 'todo', 'normal', '00000000-0000-4000-a000-000000000005', jon, null, current_date - 1),
    ('Update onboarding checklist for new CoachOS clients', null, 'done', 'normal', jon, jon, null, null);
end $$;
reset session_replication_role;

-- Sample calendar events (times are 12pm / 3pm Eastern on nearby days)
insert into events (title, description, program, starts_at, ends_at, link, created_by) values
  ('Live Q&A', 'Bring your questions — we''ll cover as many as we can.', null,
   (date_trunc('week', now() at time zone 'America/New_York') + interval '3 days 12 hours') at time zone 'America/New_York',
   (date_trunc('week', now() at time zone 'America/New_York') + interval '3 days 13 hours') at time zone 'America/New_York',
   'https://zoom.us', '00000000-0000-4000-a000-000000000005'),
  ('CoachOS office hours', 'Drop in with setup questions: domains, calendars, email.', 'coachos',
   (current_date + 2 + time '15:00') at time zone 'America/New_York',
   (current_date + 2 + time '16:00') at time zone 'America/New_York',
   'https://zoom.us', '00000000-0000-4000-a000-000000000004'),
  ('Alive & Free workshop: Clarifying your offer', null, 'alive_free',
   (current_date + 6 + time '12:00') at time zone 'America/New_York',
   (current_date + 6 + time '13:30') at time zone 'America/New_York',
   null, '00000000-0000-4000-a000-000000000005');
