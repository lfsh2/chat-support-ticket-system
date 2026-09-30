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
