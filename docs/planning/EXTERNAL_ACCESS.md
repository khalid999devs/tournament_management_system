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
- Gmail SMTP App Password: not yet configured.
- Supabase server-only secret key: configured locally and verified against the Auth Admin API.

## Needed now to activate staff access

- Sign in at `/staff/login` with the password set during setup and review the protected Admin pages.
- A Google App Password for `ndcakofficial@gmail.com` (`SMTP_PASSWORD`).

A Session Pooler URL may optionally be stored as `MIGRATION_DATABASE_URL` for long-running local administration. It is not blocking the current schema because the initial Drizzle migration completed successfully through the Transaction Pooler.

The initial Super Admin identity is `ndcakofficial@gmail.com`. The Phase 3 operator-invitation workflow uses the server-only key for Auth Admin link generation; the key is not needed for public registration or Super Admin payment review.

## Needed to complete production deployment

- Vercel CLI signed in with the account that should own the project.
- The site uses the free `*.vercel.app` address; no custom domain is needed.

## Needed if anti-bot protection is enabled

- Cloudflare Turnstile site key.
- Cloudflare Turnstile secret key.

## Requested only after committee confirmation

- Final event dates, venue, reporting/check-in guidance, and timezone wording.
- Game list, fees, capacities, rules, formats, and scoring adapters.
- Payment methods, receiving accounts, and participant-facing instructions.
- Department/year options and eligibility rules.
- Registration resubmission, walkover, tie-break, and result-publication policies.
