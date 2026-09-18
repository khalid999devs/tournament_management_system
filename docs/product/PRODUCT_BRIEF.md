# Product Brief

## Product promise

NDCAK Digital Tournament Management System is a focused university event platform with three deliberately different experiences:

1. Participants register once without an account, select all desired games, submit one payment reference, and wait for manual verification.
2. Super Admin manages configuration, registrations, payments, operators, assignments, matches, reports, and audited corrections.
3. Score Operators see only assigned operational work and use game-specific score entry.

## Non-negotiable product rules

- A submitted registration is `PENDING_REVIEW`, never confirmed automatically.
- Selected games and capacity reservations are created atomically with registration and payment data.
- Capacity includes pending reservations and confirmed entries unless event policy is explicitly changed.
- Matches use a `match_entries` relationship and support two or more competitors.
- Operator access is resolved from active, additive assignment scopes at request time.
- Every privileged mutation repeats authorization and server-side validation.
- Payment details are never visible to Score Operators.
- Completed results cannot be silently rewritten. Corrections require admin authority, a reason, and an audit record.
- Realtime improves awareness but PostgreSQL remains the source of truth.
- Participant, registration, payment, and match state changes are transactional and idempotent where retries are possible.

## First production event scope

### P0

- Public landing, schedule, rulebook, and complete registration journey.
- Manual payment submission and Super Admin approval/rejection.
- Staff authentication and role resolution.
- Tournament/game configuration, participant entries, rounds, matches, and multi-competitor match entries.
- Flexible operator assignments.
- Adapter-based score entry, optimistic concurrency, progression, and audit.
- Transactional email records with post-commit delivery.
- Server-side search, filtering, sorting, and pagination.
- Responsive, accessible public and operator experiences.
- Unit, integration, and end-to-end coverage of critical workflows.

### Deferred unless needed for the first event

- Public live results.
- QR check-in.
- Waitlists.
- Team/doubles entities.
- Round-robin/group-stage engine.
- Automated payment gateway verification.
- Certificates and multi-year archives.

## Current implementation assumptions

- Primary timezone: `Asia/Dhaka`; timestamps are stored in UTC.
- Currency: BDT, stored as integer minor units.
- Staff authentication: Supabase Auth with cookie-based SSR sessions.
- Application data access: server-only Drizzle queries against Supabase PostgreSQL.
- Public mutations: trusted Next.js server code with schema validation and anti-abuse protection.
- Hosting: Vercel, with Supabase, Resend, and optional Cloudflare Turnstile.

## Decisions still owned by the committee

- Final game catalog and exact game-specific rules.
- Registration open/close times.
- Fees, capacities, maximum games per participant, and payment receiving accounts.
- Rejected-registration resubmission policy.
- Draw/tie-break and walkover policies by game.
- Progression mode for each tournament game.
- Public visibility of results and tournament-wide awards.
- Reminder schedule and participant-safe email wording.
