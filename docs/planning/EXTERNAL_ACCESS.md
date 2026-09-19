# External Access Checklist

For deployment steps see [Deployment](../operations/DEPLOYMENT.md). `pnpm readiness:check` reports what is still missing without changing data or sending email.

No secrets should be pasted into chat, committed, or placed in client-exposed variables unless explicitly public.

## Connection status

- Supabase project URL: configured locally.
- Supabase publishable key: configured locally and verified.
- Supabase Auth endpoint: reachable.
- Application schema: migrated and verified on the live project.
- Transaction Pooler: configured on port 6543 and verified for runtime and migrations.
- Direct PostgreSQL URL: not used because it is IPv6-only in this environment.
- Official Super Admin Auth user and active profile: confirmed with password set; normal staff sign-in remains to be reviewed.
- Gmail SMTP App Password: configured and delivering (registration and approval email verified from the deployed site).
- Supabase server-only secret key: configured locally and verified against the Auth Admin API.

## Needed now to activate staff access

- Rotate the Google App Password for `ndcakofficial@gmail.com` that appeared
  in a screenshot, put it in `.env.local`, then run
  `pnpm vercel:env SMTP_PASSWORD` and redeploy.

A Session Pooler URL may optionally be stored as `MIGRATION_DATABASE_URL` for long-running local administration. It is not blocking the current schema because the initial Drizzle migration completed successfully through the Transaction Pooler.

The initial Super Admin identity is `ndcakofficial@gmail.com`. The Phase 3 operator-invitation workflow uses the server-only key for Auth Admin link generation; the key is not needed for public registration or Super Admin payment review.

## Production deployment

- Deployed at https://ndcak-indoor-games.vercel.app (Vercel project
  `ndcak-indoor-games`). Settings are copied from `.env.local` with
  `pnpm vercel:env`; `CRON_SECRET` is set and the daily job runs at 09:00
  Dhaka time.
- Supabase Authentication needs no URL configuration: invitation and password
  links point at this app's `/auth/confirm`.
- Connecting the GitHub repository for automatic deploys needs a GitHub login
  connection on the Vercel account, which it does not have yet. Deploys run
  from the CLI.

## Not needed for now

Cloudflare Turnstile keys. Registration and staff sign-in are limited by
attempt counters in the database instead, which need no extra account.

## Requested only after committee confirmation

- Final event dates, venue, reporting/check-in guidance, and timezone wording.
- Game list, fees, capacities, rules, formats, and scoring adapters.
- Payment methods, receiving accounts, and participant-facing instructions.
- Department/year options and eligibility rules.
- Registration resubmission, walkover, tie-break, and result-publication policies.
