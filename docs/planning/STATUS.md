# Implementation Status

Last updated: 19 September 2026

## Current phase

Phases 0–3 are complete in code and verified against a real PostgreSQL database. The next build phase is Phase 4 - Matches and Scoring, designed in `docs/architecture/SCORING_AND_REALTIME.md`. The live tournament holds clearly marked demo configuration (five games; bKash, Nagad and Rocket) and stays in Draft; deployment waits until all phases are complete. Going live still needs the committee's event data (entered in `/admin/event` and `/admin/games`), a Gmail App Password for email, and a Vercel deployment; none of these blocks Phase 4 development.

## Completed

- Reviewed every repository source artifact and visually reviewed all 25 PRD pages and supplied design assets.
- Extracted the complete PRD into a searchable text artifact and established the seven-phase roadmap.
- Built and verified the Next.js, TypeScript, Drizzle, Supabase, email, validation, and testing foundation.
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
- Made public pages prerendered with a 60-second tagged cache, replaced stalled database sockets automatically, and cut logo and share-image weight by over 95%.
- Refocused the landing page on the championship, added a scrolling highlights bar and a mobile menu, and removed the non-functional schedule filters.
- Added admin event settings (`/admin/event`): tournament creation, details, registration window, department and year lists, check-in instructions, payment methods, a readiness checklist, and audited status changes. Registration cannot open until the required checklist items pass.
- Added admin game management (`/admin/games`): add, configure, open, close and remove games, with capacity blocked below places already taken and removal blocked once a game has registrations. Every change is audited and refreshes public pages immediately.
- Public pages now read the configured lineup, fees, remaining places, dates, venue, description and game rules; registration respects the configured opening and closing times.
- Registration now validates department and academic year against the configured lists on the server.
- Fixed duplicate-registration and duplicate-transaction errors showing a generic failure: the database error is wrapped by Drizzle, so the friendly message was never matched.
- Added a 27-test PostgreSQL integration suite (`pnpm test:integration`, see `docs/qa/INTEGRATION_TESTS.md`) covering last-place concurrency, idempotent retries, duplicate rules, approve/reject consistency and double-clicks, all five operator scopes, capability limits, revocation, and the event-settings rules.
- Reviewed every admin and operator page with signed-in sessions at 1440px and 390px; raised staff text to 11–14px, compacted the mobile admin header, added active navigation, and turned the operator match list into cards on phones. No page scrolls sideways at 390px.
- Rehearsed the full flow in a browser against a local database with real Supabase Auth sessions: create the event, configure it, add and open games, open registration, register as a student, approve as admin, and view a game-scoped operator workspace that shows only its matches.

## Phase boundary

Phase 1 and Phase 2 exit evidence is recorded in `PHASE_2_COMPLETION.md`. Phase 3 exit evidence is recorded in `PHASE_3_PROGRESS.md`: all five scopes, combinations, capability limits and revocation pass against PostgreSQL, and a signed-in operator sees only assigned matches. The one Phase 3 item that remains is delivering an invitation email to a separate inbox, which needs a verified sending domain.

## Operational activation still required

The implementation is complete, but the live database intentionally contains no invented event configuration:

- `tournaments`: 0
- `payment_methods`: 0
- `staff_profiles`: 1 official Super Admin
- `registrations`: 0

A test operator Auth user, `ndcakofficial+operator-test@gmail.com`, exists in Supabase Auth for local rehearsals. It has no profile in the live database, so it cannot open any staff page there.

Before people can use the live workflows:

1. Sign in with the official Admin account, open `/admin/event`, and enter the committee-approved details, games, fees, capacities, rules and payment accounts. The readiness checklist shows what is missing.
2. Open registration from `/admin/event` once the checklist passes.
3. Create a Google App Password for `ndcakofficial@gmail.com` and set `SMTP_USER`/`SMTP_PASSWORD` locally and in Vercel (`docs/integrations/EMAIL.md`). `pnpm readiness:check` confirms the Gmail login.
4. Deploy to Vercel with the right account and set the Supabase Site URL to the `*.vercel.app` address (`docs/operations/DEPLOYMENT.md`).

## Decision log

| Date       | Decision                                                                                               | Reason                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-19 | Keep the PRD stack: Next.js, Supabase PostgreSQL/Auth/Realtime, Drizzle, Vercel.                       | It matches the approved product direction and the relational/concurrency requirements.                                                        |
| 2026-09-19 | Treat the participant journey as account-free and staff routes as authenticated.                       | This is the central experience boundary in the PRD.                                                                                           |
| 2026-09-19 | Use one feature-oriented monolith.                                                                     | It keeps transactional workflows cohesive without premature infrastructure.                                                                   |
| 2026-09-19 | Do not hardcode event fees, dates, capacities, schedules, or payment accounts.                         | The committee has not finalized them and the PRD explicitly requires configuration.                                                           |
| 2026-09-19 | Keep participant database access behind server actions with default-deny RLS.                          | It avoids exposing payment and registration mutations directly to anonymous clients.                                                          |
| 2026-09-19 | Commit notification outbox records with state, then perform external email delivery after transaction. | Authoritative state remains correct on provider failure while every intended delivery remains observable.                                     |
| 2026-09-19 | Require configured tournament start and end times before a registration can be approved.               | Approval email must contain an accurate calendar invitation; the application must not invent event data.                                      |
| 2026-09-19 | Serve public event data from a 60-second tagged cache refreshed by submissions and reviews.            | Public pages were querying the database on every visit; capacity is still re-checked in the submit transaction.                               |
| 2026-09-19 | Replace a database client idle for longer than its idle timeout before reuse.                          | Sockets that outlived a suspended machine silently hung every later query on the single pooled connection.                                    |
| 2026-09-19 | Manage one tournament at a time: the newest one that is not archived.                                  | Matches how NDCAK runs one event a year and keeps admin screens simple; archiving starts the next event.                                      |
| 2026-09-19 | Store department and academic-year lists in tournament settings and validate them on the server.       | The PRD requires configured lists; the client-side list alone let any value through.                                                          |
| 2026-09-19 | Run integration tests only against local PostgreSQL.                                                   | Every test truncates tables; the setup refuses non-local hosts so it can never touch Supabase.                                                |
| 2026-09-19 | Host on the free `*.vercel.app` address in the Mumbai region and send email through Gmail SMTP.        | NDCAK has no domain to verify with a provider such as Resend; Gmail delivers to any recipient within ~500 messages a day. Resend was removed. |
