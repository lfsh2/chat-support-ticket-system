-- Production setup: the starting channels and help articles. No test users, no sample data.
-- Safe to run more than once (existing rows are left alone).
--
--   Supabase dashboard → SQL Editor → paste this file → Run
--
-- Never run supabase/seed.sql against production: it creates @example.com test accounts.

insert into channels (slug, name, description, program, type, position) values
  ('announcements',    'announcements',    'News from the team',                       null,         'announcement', 0),
  ('general',          'general',          'Say hi and chat with everyone',            null,         'text',         1),
  ('wins',             'wins',             'Share your wins, big and small',           null,         'text',         2),
  ('coachos-help',     'coachos-help',     'Questions about using CoachOS',            'coachos',    'text',         10),
  ('tech-setup',       'tech-setup',       'Domains, email and integrations',          'coachos',    'text',         11),
  ('feature-requests', 'feature-requests', 'Ideas to make CoachOS better',             'coachos',    'text',         12),
  ('community',        'community',        'The Alive & Free community',               'alive_free', 'text',         20),
  ('resources',        'resources',        'Worksheets, recordings and links',         'alive_free', 'text',         21)
on conflict (slug) do nothing;

insert into kb_articles (slug, title, body_md, program, category, published) values
  ('connect-godaddy-domain', 'Connect your GoDaddy domain to your CoachOS website',
   E'1. Sign in to GoDaddy and open **My Products → DNS** for your domain.\n2. Add a **CNAME** record: name `www`, value from **CoachOS → Settings → Domains**.\n3. Back in CoachOS, click **Verify**. Changes can take up to an hour.\n\nStill not working? Open a ticket and include a screenshot of your DNS page.',
   'coachos', 'website_domain', true),
  ('share-loom-video', 'How to share a Loom video in a ticket',
   E'A quick video is often the fastest way to show us a problem.\n\n1. Record with [Loom](https://www.loom.com).\n2. Click **Share → Copy link**.\n3. Paste the link into your ticket message.',
   null, 'tech', true),
  ('update-billing-details', 'Updating your billing details',
   E'Go to **Me → Manage billing**. You can update your card, see invoices, and change your plan there.',
   null, 'billing', true)
on conflict (slug) do nothing;
