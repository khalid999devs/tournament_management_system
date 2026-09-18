# External Access Checklist

No secrets should be pasted into chat, committed, or placed in client-exposed variables unless explicitly public.

## Connection status

- Supabase project URL: configured locally.
- Supabase publishable key: configured locally and verified.
- Supabase Auth endpoint: reachable.
- Application schema: migrated and verified on the live project.
- Transaction Pooler: configured on port 6543 and verified for runtime and migrations.
- Direct PostgreSQL URL: not used because it is IPv6-only in this environment.
- Official Super Admin Auth user: not created yet.
- Resend API key: configured and valid.
- Resend verified sending domains: none.

## Needed now to complete staff integration

- Create `ndcakofficial@gmail.com` in Supabase Authentication with a secure password or invitation.
- Resend-verified NDCAK sending domain.

A Session Pooler URL may optionally be stored as `MIGRATION_DATABASE_URL` for long-running local administration. It is not blocking the current schema because the initial Drizzle migration completed successfully through the Transaction Pooler.

The initial Super Admin identity is `ndcakofficial@gmail.com`. The Supabase secret/service-role key is not needed yet and should not be supplied preemptively. It will be requested only if the staff-invitation workflow cannot be implemented through a narrower server-side mechanism.

## Needed to complete email delivery

- Verified sender domain or address.
- Approved `From` name and organizer reply-to address.

## Needed to complete production deployment

- Vercel project/team access.
- Final production domain and `NEXT_PUBLIC_APP_URL`.
- Production and preview environment ownership decisions.

## Needed if anti-bot protection is enabled

- Cloudflare Turnstile site key.
- Cloudflare Turnstile secret key.

## Requested only after committee confirmation

- Final event dates, venue, reporting/check-in guidance, and timezone wording.
- Game list, fees, capacities, rules, formats, and scoring adapters.
- Payment methods, receiving accounts, and participant-facing instructions.
- Department/year options and eligibility rules.
- Registration resubmission, walkover, tie-break, and result-publication policies.
