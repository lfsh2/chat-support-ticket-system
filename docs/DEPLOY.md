# Going live

The app runs on **DigitalOcean App Platform**. The database, sign-in, realtime and file
storage run on **Supabase**. Do the steps in order; each one takes a few minutes.

## 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → **New project**. Use the **Pro** plan for real
   clients (free projects pause after a week of inactivity and have no backups).
2. Pick the region closest to your DigitalOcean app (e.g. both in US East).
3. Save the **database password** somewhere safe.
4. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the
   **service_role** key. The service_role key bypasses all security rules — it only ever
   goes in server environment variables, never in the browser or in git.

## 2. Set up the database

From this folder, on your computer:

```bash
pnpm exec supabase login                       # opens the browser once
pnpm exec supabase link --project-ref <ref>    # <ref> is in the project URL: https://<ref>.supabase.co
pnpm exec supabase db push                     # creates every table, rule and trigger
```

Then **Supabase → SQL Editor**: paste `supabase/production.sql` and **Run**. This adds the
channels and help articles.

> Never run `supabase/seed.sql` in production — it creates `@example.com` test accounts.

## 3. Sign-in settings (Supabase → Authentication)

- **URL Configuration**
  - Site URL: `https://<your hub domain>`
  - Redirect URLs: `https://<your hub domain>/**`
- **Sign In / Providers → Email**: keep Email on, and turn **"Allow new users to sign up" off**.
  The app creates accounts itself, only after checking the person has a membership.
- **Emails → SMTP Settings**: turn on **custom SMTP**. Supabase's built-in sender only
  delivers to your own team and a couple of emails an hour, so clients would never get
  their sign-in link. With Resend: host `smtp.resend.com`, port `465`, user `resend`,
  password = your Resend API key, sender e.g. `support@<your domain>` (verify the domain in
  Resend first).
- **Emails → Templates → Magic Link**: subject `Your sign-in link`, and paste the contents of
  `supabase/templates/magic-link.html` as the body.
- **Rate Limits**: raise "emails sent per hour" to something like 100.

## 4. DigitalOcean environment variables

App Platform → your app → **Settings → App-Level Environment Variables**:

| Variable | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://<your hub domain>` | Build and Run time |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 | Build and Run time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key | Build and Run time |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key — tick **Encrypt** | Run time |
| `NEXT_PUBLIC_APP_NAME` | optional, e.g. `Alive + Free Client Hub` | Build and Run time |

`NEXT_PUBLIC_*` values are baked in when the app is built, so they must be available at
**build** time. Changing them needs a redeploy.

**Delete** these if they're still set from the demo: `NEXT_PUBLIC_DEMO_OFFLINE`,
`DEMO_MODE`, `DEMO_LOGIN_KEY`, `DEV_LOGIN`.

Build command `pnpm build`, run command `pnpm start`. Deploy.

## 5. Check it

Open `https://<your hub domain>/api/health`. You want `"ok": true`, `"database": "ok"`,
`"channels": 8` and `"testUsers": 0`. If something's wrong it says which setting is missing.

## 6. Let people in

Until the admin Members screen and Stripe sync are built, access is granted from the terminal.
Create `.env.production.local` in this folder (it's git-ignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

Then:

```bash
pnpm access staff spencer@<domain> owner          # team: agent | admin | owner
pnpm access staff sammi@<domain> owner
pnpm access grant client@example.com coachos      # clients: coachos | alive_free
pnpm access revoke client@example.com coachos
pnpm access list
```

People sign in at `/login` with that email and get a link by email.

## 7. Smoke test

1. Sign in as yourself (owner) → Dashboard shows the team view; Tasks tab is there.
2. Grant a test client (a real inbox you control), sign in on your phone → only that
   program's channels show; **Get help** opens a ticket.
3. Back as owner: the ticket is in **Tickets → Unassigned**; reply, add an internal note,
   check the client sees the reply but not the note.
4. Add a calendar event for that program; the client sees it on their dashboard.
5. `pnpm access revoke` the test client → their next page load shows "access ended".

## Not built yet (plan around these)

- **No email notifications** for new tickets or replies yet — the team needs to check the
  dashboard, and clients see replies when they open the hub.
- **No Stripe sync** — paying doesn't grant access automatically; use `pnpm access grant`.
- **No admin Members screen**, Inbox, threads or @mentions yet.
