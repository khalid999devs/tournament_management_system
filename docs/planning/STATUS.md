# Project status

Last updated: 20 September 2026

## Where it stands

The platform is built, deployed at https://ndcak-indoor-games.vercel.app and
rehearsed there end to end. What the rehearsal measured, and the two problems
it found, are in [`LAUNCH_REPORT.md`](LAUNCH_REPORT.md).

The live site still holds demo configuration: five games, demo dates and
venue. Registration is open, but the payment numbers are deliberate
placeholders (`01XXX-XXXXXX`) so nobody can pay before the committee publishes
the real ones.

## Before launch (owner actions)

- Replace the demo event data in **Event settings** and **Games** with the
  committee's own details, including the real bKash, Nagad and Rocket numbers,
  then reopen registration.
- Rotate the Gmail App Password that appeared in a screenshot, then
  `pnpm vercel:env SMTP_PASSWORD` and redeploy. `pnpm readiness:check`
  confirms the new one.
- Confirm Vercel Hobby's non-commercial rule covers this event, or move to
  another free host (see
  [`../architecture/SCORING_AND_REALTIME.md`](../architecture/SCORING_AND_REALTIME.md)).
- Rehearse on the deployed site with real phones on the venue network, as
  [`../operations/EVENT_DAY_RUNBOOK.md`](../operations/EVENT_DAY_RUNBOOK.md)
  describes.

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
| 2026-09-20 | One assignment per operator and target, enforced by a unique constraint.                                  | Granting the same scope twice used to stack a second row; a repeat grant now rewrites the first and restores a removed one.                   |
| 2026-09-20 | Handing an operator a game gives full scoring by default, narrowed afterwards if needed.                  | Ticking a game on the operator list is the everyday action; making the admin choose capabilities first made a simple job look complicated.    |
