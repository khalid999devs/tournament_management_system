# Implementation Status

Last updated: 19 September 2026

## Current phase

Phase 3 - Operators and Assignments is implemented in code. The server-only Supabase key works, and the official Super Admin account is confirmed with a password and active profile. A verified Resend sender and live operator/access rehearsal remain pending.

## Completed

- Reviewed every repository source artifact and visually reviewed all 25 PRD pages and supplied design assets.
- Extracted the complete PRD into a searchable text artifact and established the seven-phase roadmap.
- Built and verified the Next.js, TypeScript, Drizzle, Supabase, Resend, validation, and testing foundation.
- Applied the 16-table schema to the live Supabase PostgreSQL database with row-level security enabled and default-deny browser access.
- Added Supabase SSR session refresh, verified-claim staff identity, application-profile authorization, and role routing.
- Generated and integrated compact and full NDCAK logo variants with corrected proportions.
- Refined the public home, registration, schedule, rulebook, results, navigation, and footer around the approved NDCAK visual system.
- Implemented the complete account-free participant flow: details, multi-game selection, review, configured payment instructions, atomic submission, and pending receipt.
- Made fee, availability, registration-window, payment-method, participant, and transaction checks server-authoritative.
- Enforced idempotent submission, normalized provider transaction uniqueness, duplicate active-registration prevention, and guarded capacity reservations.
- Added submission, approval, and rejection email builders with escaped participant content and approval-only calendar invitations.
- Added the Super Admin dashboard, server-side registration search/filter/sort/pagination, review detail, approval, rejection, and notification delivery views.
- Made approval/rejection idempotent and atomic, with registration, payment, game-entry, capacity-counter, notification-outbox, and audit updates in one transaction.
- Kept email delivery outside authoritative transactions and made failed/queued delivery manually retryable.
- Added deterministic registration and notification pagination state to URL query parameters.
- Verified formatting, type checking, linting, 19 unit tests, production build, live public route rendering, protected admin redirect, and live database connectivity.
- Replaced one-off email markup with branded React Email HTML/plain-text templates for registration, operator invitations, reminders, schedule changes, and support acknowledgment. Only the first four registration/operator states are wired to live outbox delivery.
- Added a development-only email design preview covering seven states.
- Implemented operator creation, time-limited branded invitations, password setup, deactivation/reactivation, assignment grants/revocation, and audit records.
- Added all five additive scope types and capability-aware match filtering before pagination; operator workload queries exclude payment fields.
- Applied and verified the additive staff-email migration on the live database. All 16 tables remain; `staff_profiles.email` and its unique index are present.
- Passed type checking, linting, 32 tests, production build, development email preview HTTP check, and unauthenticated operator redirect check.
- Browser-reviewed all seven email states at 1440px and 390px. The preview now sizes to its content; all 14 Playwright viewport checks pass without clipping or horizontal overflow.

## Phase boundary

Phase 1 and Phase 2 exit evidence is recorded in `PHASE_2_COMPLETION.md`. Phase 3 code is ready for a live staff rehearsal, but the phase is not marked complete until an invited operator accepts a real email and all five scopes are checked against populated tournament matches. Email visual review is complete; authenticated staff pages still need a real-account browser pass.

## Operational activation still required

The implementation is complete, but the live database intentionally contains no invented event configuration:

- `tournaments`: 0
- `payment_methods`: 0
- `staff_profiles`: 1 official Super Admin
- `registrations`: 0

Before people can use the live workflows:

1. Sign in with the official Admin account and review the protected pages.
2. Supply the committee-approved tournament, games, capacities, fees, registration window, event dates, venue, rules, and payment receiving accounts.
3. Verify an NDCAK-controlled domain in Resend and replace the sandbox `EMAIL_FROM` value.
4. Configure Supabase Auth SMTP in the dashboard with the verified sender.
5. Supply Vercel access, the production domain, and production environment ownership when deployment is authorized.

## Decision log

| Date       | Decision                                                                                               | Reason                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 2026-09-19 | Keep the PRD stack: Next.js, Supabase PostgreSQL/Auth/Realtime, Drizzle, Resend, Vercel.               | It matches the approved product direction and the relational/concurrency requirements.                          |
| 2026-09-19 | Treat the participant journey as account-free and staff routes as authenticated.                       | This is the central experience boundary in the PRD.                                                             |
| 2026-09-19 | Use one feature-oriented monolith.                                                                     | It keeps transactional workflows cohesive without premature infrastructure.                                     |
| 2026-09-19 | Do not hardcode event fees, dates, capacities, schedules, or payment accounts.                         | The committee has not finalized them and the PRD explicitly requires configuration.                             |
| 2026-09-19 | Keep participant database access behind server actions with default-deny RLS.                          | It avoids exposing payment and registration mutations directly to anonymous clients.                            |
| 2026-09-19 | Commit notification outbox records with state, then perform external email delivery after transaction. | Authoritative state remains correct on provider failure while every intended delivery remains observable.       |
| 2026-09-19 | Require configured tournament start and end times before a registration can be approved.               | Approval email must contain an accurate calendar invitation; the application must not invent event data.        |
| 2026-09-19 | Serve public event data from a 60-second tagged cache refreshed by submissions and reviews.            | Public pages were querying the database on every visit; capacity is still re-checked in the submit transaction. |
| 2026-09-19 | Replace a database client idle for longer than its idle timeout before reuse.                          | Sockets that outlived a suspended machine silently hung every later query on the single pooled connection.      |
