# Implementation Status

Last updated: 20 September 2026

## Current phase

All seven phases (0 to 6) are complete. The platform is deployed at
https://ndcak-indoor-games.vercel.app and was rehearsed there end to end;
evidence is in `PHASE_6_COMPLETION.md`. The live tournament still holds demo
configuration (five games, demo dates and venue) and registration is open, but
the payment numbers are deliberate placeholders so nobody can pay before the
committee publishes the real ones. What remains is the committee's own data
and the pre-event rehearsal with real phones.

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
- Redesigned the registration flow: two-column layout with a sticky summary on desktop, a fixed total bar on phones, clearer game cards with places left, friendly validation messages, copy-to-clipboard payment numbers, and a round trip from review back to editing. Landing-page game cards open registration with that game preselected. Schedule lists fixtures by day once the draw is published. Fixed a bug where restored drafts ignored typing.
- Phase 4: seven configurable scoring types, knockout draws with byes, manual rounds, an append-only score log with idempotent commands and version checks, an offline-safe operator score screen, admin match monitor and corrections, and public confirmed results. See `PHASE_4_COMPLETION.md`.
- Phase 6: deployed to Vercel with the daily job running, attempt limits and security headers, WCAG 2.1 AA and five-width checks on every page, a 39-test browser suite, backups with a verified restore, emergency admin access, an event-day runbook, and a full rehearsal on the live site that found and fixed two real problems. See `PHASE_6_COMPLETION.md`.
- Phase 5: live updates on every staff screen through private Supabase Realtime channels, with polling underneath; an admin dashboard counted from the database; problem reports from operators with admin resolution; five filtered CSV exports; a configurable reminder email with a daily job that also retries email and keeps Supabase awake. See `PHASE_5_COMPLETION.md`.

## Phase boundary

Phase 1 and 2 evidence is in `PHASE_2_COMPLETION.md`, Phase 3 in `PHASE_3_PROGRESS.md`, Phase 4 in `PHASE_4_COMPLETION.md`, and Phase 5 in `PHASE_5_COMPLETION.md`.

## Before launch (owner actions)

- Replace the demo event data in `/admin/event` and `/admin/games` with the committee's details, including the real bKash, Nagad and Rocket numbers, then reopen registration.
- Rotate the Gmail App Password that appeared in a screenshot; `pnpm readiness:check` confirms the new one.
- Confirm Vercel Hobby's non-commercial rule covers this event, or move to another free host (see `SCORING_AND_REALTIME.md`).
- Rehearse on the deployed site with real phones on the venue network, as `docs/operations/EVENT_DAY_RUNBOOK.md` describes.

## Decision log

| Date       | Decision                                                                                                  | Reason                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-19 | Keep the PRD stack: Next.js, Supabase PostgreSQL/Auth/Realtime, Drizzle, Vercel.                          | It matches the approved product direction and the relational/concurrency requirements.                                                        |
| 2026-09-19 | Treat the participant journey as account-free and staff routes as authenticated.                          | This is the central experience boundary in the PRD.                                                                                           |
| 2026-09-19 | Use one feature-oriented monolith.                                                                        | It keeps transactional workflows cohesive without premature infrastructure.                                                                   |
| 2026-09-19 | Do not hardcode event fees, dates, capacities, schedules, or payment accounts.                            | The committee has not finalized them and the PRD explicitly requires configuration.                                                           |
| 2026-09-19 | Keep participant database access behind server actions with default-deny RLS.                             | It avoids exposing payment and registration mutations directly to anonymous clients.                                                          |
| 2026-09-19 | Commit notification outbox records with state, then perform external email delivery after transaction.    | Authoritative state remains correct on provider failure while every intended delivery remains observable.                                     |
| 2026-09-19 | Require configured tournament start and end times before a registration can be approved.                  | Approval email must contain an accurate calendar invitation; the application must not invent event data.                                      |
| 2026-09-19 | Serve public event data from a 60-second tagged cache refreshed by submissions and reviews.               | Public pages were querying the database on every visit; capacity is still re-checked in the submit transaction.                               |
| 2026-09-19 | Replace a database client idle for longer than its idle timeout before reuse.                             | Sockets that outlived a suspended machine silently hung every later query on the single pooled connection.                                    |
| 2026-09-19 | Manage one tournament at a time: the newest one that is not archived.                                     | Matches how NDCAK runs one event a year and keeps admin screens simple; archiving starts the next event.                                      |
| 2026-09-19 | Store department and academic-year lists in tournament settings and validate them on the server.          | The PRD requires configured lists; the client-side list alone let any value through.                                                          |
| 2026-09-19 | Run integration tests only against local PostgreSQL.                                                      | Every test truncates tables; the setup refuses non-local hosts so it can never touch Supabase.                                                |
| 2026-09-19 | Host on the free `*.vercel.app` address in the Mumbai region and send email through Gmail SMTP.           | NDCAK has no domain to verify with a provider such as Resend; Gmail delivers to any recipient within ~500 messages a day. Resend was removed. |
| 2026-09-19 | Store every score change as an append-only update with a per-match sequence and a client event id.        | Retries after lost responses apply once, simultaneous operators never overwrite each other, and the log keeps server and device times.        |
| 2026-09-19 | Make scoring types configurable per game and freeze the settings once play starts.                        | New games need settings, not code, and every result in a game is judged by the same rules.                                                    |
| 2026-09-19 | Poll every 6 seconds on open score screens until Phase 5 realtime.                                        | Keeps screens current on the free plans; realtime will replace polling, and scoring never depends on either.                                  |
| 2026-09-20 | Send live-update signals from the server after each commit instead of database triggers.                  | Simpler, testable on plain PostgreSQL, and nothing in the database depends on Realtime; screens still poll underneath.                        |
| 2026-09-20 | One Realtime access rule: active staff may listen, and no browser may send.                               | Signals carry only ids and a version, so finer per-match rules would add complexity without protecting any data.                              |
| 2026-09-20 | One reminder per registration per event day, queued by a daily job or an admin's "send now".              | Unique keys make every run safe to repeat, and Vercel Hobby allows one scheduled run a day.                                                   |
| 2026-09-20 | Record every CSV export in the audit log.                                                                 | Exports contain participant contact details.                                                                                                  |
| 2026-09-20 | Send one query at a time per database connection, with a patch to postgres.js so transactions still work. | Pipelined queries can stall through Supabase's transaction pooler; an admin page hung for 89 seconds during the rehearsal.                    |
| 2026-09-20 | Keep the live payment numbers as placeholders until the committee publishes the real ones.                | The site is reachable, and a demo number could take real money from a student.                                                                |
| 2026-09-20 | Limit attempts in PostgreSQL rather than adding an anti-bot service.                                      | It needs no extra account or key, works across serverless instances, and the PRD allows rate limiting in place of Turnstile.                  |
