# Phase 5 Completion Record - Realtime, Analytics and Communication

Completed: 20 September 2026

## Exit criteria

| Exit criterion                                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Staff views update near real time but remain correct after disconnect/reload. | After each commit the server sends a signal carrying only ids and a version; screens fetch the change through their usual authorized routes. Every reconnect refetches, and polling stays as a fallback. In the two-screen walkthrough a point reached the other screen in 0.3 s, and after three seconds offline the operator's screen caught up 0.15 s after reconnecting. An integration test pins the exact signal content.                                          |
| Dashboard metrics are derived from authoritative state with explicit labels.  | `/admin` counts every figure from the database on each request for the current tournament: registrations by status, fees verified and awaiting review (labelled as amounts participants were asked to pay, not an accounting record), confirmed game entries, matches by status, operators on duty, recent score activity, open problem reports and email delivery problems. An integration test checks each figure against seeded data.                                 |
| Exports respect filters and represent the full server-side result set.        | Five CSV exports built on the server: registrations, confirmed players by game, payment verification, match results and operator activity. The Registrations and Matches pages export their current filters. Tests export 30 rows (more than one 25-row page) and filtered subsets; the walkthrough download held all 16 of 16 rows. Cells that a spreadsheet would run as formulas are neutralised, and each download is audited.                                       |
| Reminder jobs are idempotent and delivery is observable.                      | One reminder per registration per event day, enforced by a unique key. Three simultaneous runs queued exactly one reminder per confirmed player; two overlapping send runs sent each once; a registration cancelled after queueing is not emailed. Delivery shows on the Event settings panel (sent, waiting, failed) and on the Notifications page, now filterable by type and date. In the walkthrough 14 reminders went out and pressing "Send now" again added none. |

Issue reporting, also in the Phase 5 scope, is built: operators with the `ISSUE_REPORT` capability flag a problem from the score screen (or a general one from their match list), admins see it straight away and resolve it with a note. Resent reports land once, and both steps are audited.

## What was built

- **Live updates:** `src/lib/realtime/`. Private Supabase Realtime channels per match and per tournament. The score screen, dashboard, match monitor, registrations queue, problem reports page and operator match list update by themselves and show a Live badge.
- **Dashboard:** `src/features/analytics/server/dashboard.ts`, rendered at `/admin`.
- **Problem reports:** `src/features/issues/`, the score screen section, `/admin/issues` and a count in the admin menu.
- **Exports:** `src/features/analytics/server/exports.ts`, `/admin/reports` and `/admin/reports/export/[kind]`.
- **Reminder email:** `src/features/notifications/server/reminders.ts`, with a panel in Event settings to choose the day (off, or 1, 2, 3 or 7 days before) and send it now.
- **Daily job:** `/api/cron/daily`, scheduled in `vercel.json` and protected by `CRON_SECRET`. It queues due reminders, sends waiting emails, retries failed ones up to three attempts, recovers messages stuck mid-send and keeps the free Supabase project awake.

## Database

Migration `0003_live_updates_and_issues` adds the `issue_reports` table (row-level security on, default deny), `tournaments.reminder_days_before`, and on Supabase only the Realtime access rule with its `private.is_active_staff()` check. It was applied to the live project on 20 September 2026, which now has four migrations.

## Verification

- **Tests:** 109 unit tests (15 new) and 52 integration tests (10 new) pass, with lint, type checks and the production build.
- **Live authorization check** on the real project with throwaway accounts, deleted afterwards:

  | Case                                      | Result                                    |
  | ----------------------------------------- | ----------------------------------------- |
  | Active staff joins a private channel      | Joined on the first attempt               |
  | Server signal to two staff listeners      | Accepted (202), delivered in about 170 ms |
  | Signed-in account without a staff profile | Refused                                   |
  | Anonymous visitor                         | Refused                                   |
  | Staff member after deactivation           | Refused                                   |
  | Message sent from a browser               | Never reached other staff                 |

- **Two-screen walkthrough:** local production build with local data, live Supabase sign-in and Realtime, and email sent to a local test mail server so nothing left the machine. Measured without reloading either screen:

  | Change                                                 | Seen on the other screen |
  | ------------------------------------------------------ | ------------------------ |
  | Operator enters a point, admin's match page            | 0.3 s                    |
  | Admin enters a point, operator's phone                 | 0.3 s                    |
  | Match started or scored, admin match monitor           | 2 s                      |
  | Problem reported, admin dashboard count                | 1.1 to 1.7 s             |
  | Report resolved, operator's phone (section stays open) | under 1 s                |
  | Operator offline for 3 s, catch-up after reconnecting  | 0.15 s                   |

  The registrations export held all 16 of 16 rows; the activity export listed the operator's actions; 14 reminder emails arrived with games, date, venue and check-in details; the daily job refused a request without its secret (401) and ran with it (200). No page scrolled sideways at 390 or 1440 px, and no browser errors appeared apart from the expected failed requests while deliberately offline.

## Kept out to stay simple

- **Cross-game awards leaderboard** (PRD 11.3 says "may"): it needs the committee's points and tie-break rules.
- **Schedule-change emails** (PRD P1): the template exists; wiring it needs a decision on when players should be emailed.
- **Pages to browse the audit log and a participant directory:** audit rows are written for every critical action, and the confirmed players export covers participant lists.
- **Third-place match:** only if the committee wants one.

## Carried into Phase 6

- Set `CRON_SECRET` in Vercel when deploying; `pnpm readiness:check` reports it together with the Realtime rule.
- Repeat the two-screen rehearsal on the deployed site with real phones, including cutting Realtime mid-match to confirm the fallback.
