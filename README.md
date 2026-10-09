# Alive + Free Client Hub

A private support hub for Alive & Free clients and CoachOS subscribers: Discord-style
channels, support tickets that work like private chats with the team, an internal task
tracker and a shared calendar. Mobile first.

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + RLS, Auth,
Realtime, Storage). The full product spec lives in [`CLAUDE.md`](CLAUDE.md).

## Run it locally

Needs Node 22+, pnpm and Docker (for the local Supabase).

```bash
pnpm install
pnpm db:start            # local Supabase in Docker (first run downloads images)
pnpm db:reset            # schema + test data (supabase/seed.sql)
cp .env.example .env.local   # then fill in the values `pnpm db:start` printed
pnpm dev                 # http://localhost:3000
```

With `DEV_LOGIN=true` in `.env.local`, `/login` shows one-click sign-in for the test users,
or go straight to `/auth/dev?as=agent` (also `coachos`, `alivefree`, `both`, `owner`,
`lapsed`). Sign-in emails land in Mailpit at http://127.0.0.1:54324, and the local Supabase
dashboard is at http://127.0.0.1:54323.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test                    # unit tests (Vitest)
pnpm exec playwright test    # end-to-end, against the local dev server + Supabase
```

## Database changes

Add a new file in `supabase/migrations/` (never edit one that has already run), then:

```bash
pnpm exec supabase migration up   # apply locally without wiping data
pnpm db:types                     # regenerate lib/database.types.ts
```

## Deploying

The app runs on DigitalOcean App Platform with a hosted Supabase project. Step-by-step:
[`docs/DEPLOY.md`](docs/DEPLOY.md). Until the admin Members screen exists, people are let in
with `pnpm hub` (see that guide).
