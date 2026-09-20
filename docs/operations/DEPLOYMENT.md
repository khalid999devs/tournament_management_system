# Deployment on Vercel

Live at **https://ndcak-indoor-games.vercel.app** (Vercel project
`ndcak-indoor-games`, scope `ndcakofficial-7292`). No custom domain is needed:
links in emails and page metadata use the Vercel production address
automatically, and email goes out through Gmail SMTP.

## Settings

- **Region:** `vercel.json` pins functions to `bom1` (Mumbai), next to the Supabase database in `ap-south-1`. Other regions add a long round trip to every query.
- **Database:** use the Supabase Transaction Pooler URL (port 6543) as `DATABASE_URL`. It suits serverless functions.
- **App URL:** leave `NEXT_PUBLIC_APP_URL` unset on Vercel. The app uses `VERCEL_PROJECT_PRODUCTION_URL` in production and the deployment's own URL in previews. Set it only after adding a custom domain.

## Environment variables (Production)

| Variable                               | Value                                                |
| -------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`                         | Supabase Transaction Pooler URL                      |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key                             |
| `SUPABASE_SECRET_KEY`                  | Supabase server-only secret key                      |
| `SUPER_ADMIN_EMAIL`                    | `ndcakofficial@gmail.com`                            |
| `SMTP_USER`                            | `ndcakofficial@gmail.com`                            |
| `SMTP_PASSWORD`                        | Google App Password (see `docs/operations/EMAIL.md`) |
| `EMAIL_REPLY_TO`                       | `ndcakofficial@gmail.com`                            |
| `CRON_SECRET`                          | 16+ random characters; protects the daily job        |

`SUPABASE_SECRET_KEY` also sends the live-update signals to staff screens. Without it the app still works, and staff screens fall back to refreshing every few seconds.

## Daily job

`vercel.json` runs `/api/cron/daily` once a day at 03:00 UTC (09:00 in Dhaka; the Hobby plan may run it any time within that hour). Vercel sends `CRON_SECRET` with the request, and the route refuses anything else. Each run:

- sends the event reminder on the day chosen in Event settings, to confirmed players who have not had it;
- sends emails that are still waiting and retries failed ones up to three attempts, and marks any message stuck mid-send as failed so it can be retried;
- runs one query, which keeps the free Supabase project from pausing.

Every step is safe to repeat. To run it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://….vercel.app/api/cron/daily`.

## Live updates

Staff screens listen on private Supabase Realtime channels. Migration `0003_live_updates_and_issues` adds the only access rule: active staff may listen, and no browser may send. `pnpm readiness:check` confirms it is in place. Nothing needs switching on in the Supabase dashboard.

Preview deployments should not use the production database. Until a separate Supabase project exists for previews, deploy production only.

## Deploying a change

```bash
pnpm typecheck && pnpm lint && pnpm test && vercel deploy --prod
```

The production address always points at the newest deployment. An older one
can be promoted from the Vercel dashboard's Deployments list.

## Settings and secrets

`pnpm vercel:env` copies the production values from `.env.local` to Vercel
through the CLI's standard input, so no secret is ever printed or passed on a
command line. `pnpm vercel:env SMTP_PASSWORD` pushes a single one, for example
after rotating the Gmail App Password; redeploy afterwards so the new value is
used.

`NEXT_PUBLIC_APP_URL` is deliberately not set on Vercel, and
`ENABLE_EXPERIMENTAL_COREPACK=1` is set so the build uses the pnpm version in
`package.json`.

## The postgres.js patch

`patches/postgres@3.4.9.patch` makes `sql.begin` claim its connection even
when query pipelining is off, which the app needs (see
`docs/architecture/SCORING_AND_REALTIME.md`). pnpm applies it during install.

After changing anything in `patches/`, deploy once with `vercel deploy --prod
--force`: a cached build can otherwise reuse the previous `node_modules` and
silently drop the patch, which breaks every write.

## Watching it

- `https://ndcak-indoor-games.vercel.app/api/health` answers `{"ok":true}`
  when the site can reach the database, and 503 when it cannot. It suits a
  free uptime checker.
- `vercel logs <deployment-url>` streams runtime logs, including the daily
  job's summary.
- The admin dashboard shows email that is waiting or has failed.

## First deployment elsewhere

1. `vercel login`, then `vercel link` in the repository root.
2. `pnpm vercel:env` to copy the settings, and add `CRON_SECRET` if it is not
   in `.env.local` yet.
3. `vercel deploy --prod`.
4. Sign in at `/staff/login`, invite a test operator to a second inbox, and
   confirm the email arrives and its link opens on another device.

Supabase Authentication needs no URL configuration: invitation and password
links are built by this app and point at `/auth/confirm`.

Connecting the GitHub repository in the Vercel dashboard makes every push to
`main` deploy automatically. It needs a GitHub login connection on the Vercel
account, which this account does not have yet; deploys run from the CLI.
