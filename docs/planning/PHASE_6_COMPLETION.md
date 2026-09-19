# Phase 6 Completion Record - Hardening and Launch

Completed: 20 September 2026. The platform is deployed at
**https://ndcak-indoor-games.vercel.app** and was rehearsed there.

## Exit criteria

| Exit criterion                                                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical flows pass unit, integration and end-to-end suites.                            | 110 unit tests, 55 integration tests against PostgreSQL, and a new 39-test Playwright suite (`docs/qa/END_TO_END_TESTS.md`) covering registration, admin review, operator invitations and scopes, two operators on one match, accessibility, keyboard use, screen widths and security headers.                                                                             |
| Registration, operator score entry and admin review pass target viewport checks.        | Every public, admin and operator page is checked at 320, 390, 768, 1024 and 1440 px for sideways scrolling, in the suite. Screenshots of all of them at all five widths were reviewed by eye; the fixes are listed below.                                                                                                                                                  |
| WCAG 2.1 AA checks and keyboard operation pass.                                         | axe (wcag2a, wcag2aa, wcag21a, wcag21aa) runs against every page at 390 and 1440 px with no violations. Keyboard tests cover the skip link, the phone menu, pausing the moving highlights and completing registration without a mouse.                                                                                                                                     |
| Last-slot concurrency and stale-match scenarios pass under realistic load.              | On the deployed site: twelve phones submitted for one remaining place at once and exactly one won; three matches scored by two operators at 34 requests a second recorded every event once (102 requests, all accepted, p50 262 ms, p95 1.2 s); a typed score from a phone that had lost signal was refused after the result was confirmed, and the winner still advanced. |
| Backup/restore, emergency admin access, monitoring and event-day runbook are rehearsed. | `pnpm db:backup` and `pnpm db:verify-backup` were run against the live database and the restore was checked table by table. Emergency Super Admin access was rehearsed on the deployed site. `/api/health` reports the database. The runbook is `docs/operations/EVENT_DAY_RUNBOOK.md`.                                                                                    |

## What changed

**Security.** Attempt limits on registration (30 per 10 minutes per address)
and staff sign-in (10 per 15 minutes for an address and account, 100 per 15
minutes per address), stored in PostgreSQL and keyed by a hash, never the
address itself. Content Security Policy, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` on every
response. `robots.txt` and a sitemap; staff pages stay out of search. Friendly
404 and error pages instead of framework defaults.

**Accessibility.** One skip link, correct page landmarks, a pause control for
the moving highlights, keyboard-reachable scrolling regions, and darker green
and grey so every text and status colour meets 4.5:1.

**Layout.** Admin tables become labelled cards below 1100 px; the admin menu
keeps the current page in view; the operator match list becomes cards on
phones and tablets; brackets stack on small screens; score screens got a clear
"Start match" step, larger touch targets, readable disabled buttons and
aligned score tiles. Registration on phones is tighter, with a single
"Step 1 of 3" line. About forty separate fixes came out of a page-by-page
review of every screen at five widths.

**Operations.** `pnpm db:backup`, `pnpm db:verify-backup`,
`pnpm db:invite-admin` (any address, prints the link when email is down),
`pnpm vercel:env` to copy settings to Vercel without printing secrets, and
`/api/health`.

**Public site.** A developers page listing who built the platform, fed by
`src/app/developers/developers.json`.

## Two problems the rehearsal found

**The student who took the last place saw an error page.** Taking the last
place refreshes availability, and the payment screen recalculated the fee from
that fresh data, which now said the game was full. The screen threw and the
error boundary replaced it, for the winner as well as everyone else. Both the
review and payment screens now keep working when availability changes: the
winner sees the receipt, and anyone whose game filled up gets a clear message
and a link back to change games. Covered by a test with two students racing
for one place.

**Queries could stall through Supabase's pooler.** postgres.js sends more
queries down a connection that is already busy, and through the transaction
pooler such a query can hang until the connection dies. An admin page hung for
89 seconds. The app now sends one query at a time per connection
(`max_pipeline: 0`), which needed a small patch to postgres.js so transactions
still claim their connection (`patches/postgres@3.4.9.patch`). Verified
afterwards on the live pooler: seven parallel queries in about 0.5 s, and
eight transactions with eight plain queries at once in 0.9 s. See
`docs/architecture/SCORING_AND_REALTIME.md`.

## Measured on the deployed site

| Check                                                                | Result                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Public pages on a throttled phone (4x slower processor, mobile data) | Largest paint 0.2 to 1.1 s, no layout shift, 100 to 150 KB a page  |
| Staff sign-in                                                        | 0.8 to 2.2 s                                                       |
| A point entered by an operator, seen on the admin screen             | 0.8 to 2.3 s                                                       |
| A point entered by an admin, seen on the operator's phone            | 0.04 to 0.8 s                                                      |
| Live updates blocked, same change seen by polling                    | 2.3 to 2.8 s                                                       |
| Phone offline for three seconds, catch-up after reconnecting         | 0.2 s                                                              |
| Problem report seen on the admin dashboard                           | 2.8 s                                                              |
| Resolution seen back on the operator's phone                         | 0.8 s                                                              |
| Twelve phones racing for one place                                   | One registration, eleven refused, database exactly right           |
| Scoring load: three matches, two operators, 10% resends              | 102 requests, 34 a second, all accepted, every event recorded once |
| Registration and approval email through Gmail                        | Both delivered                                                     |
| Daily job                                                            | 401 without its secret, 200 with it                                |
| Registrations export                                                 | Correct rows, comma-separated, audited                             |

Everything the rehearsal created was removed afterwards: the live tables match
the backup taken before it, row for row, and only the real Super Admin account
remains.

## Carried forward

- The committee still has to put in the real event details, rules and payment
  numbers. The live payment numbers are deliberately placeholders
  (`01XXX-XXXXXX`) so nobody can send money before they are published.
- Rotate the Gmail App Password that appeared in a screenshot, then
  `pnpm vercel:env SMTP_PASSWORD` and redeploy.
- Rehearse once more with real phones on the venue's network before the event,
  as the runbook describes.
- Vercel's Hobby plan is for non-commercial use; the association should
  confirm this event qualifies or move to another free host
  (`docs/architecture/SCORING_AND_REALTIME.md`).
