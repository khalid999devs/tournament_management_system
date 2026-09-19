# End-to-end tests

Playwright drives the real app in a browser: the participant journey, admin
review, operator invitations and scopes, two operators on one match,
accessibility, keyboard use, screen widths and the security headers.

```bash
pnpm test:e2e                 # full run
pnpm test:e2e --keep          # leave the server, mail sink and accounts up
pnpm test:e2e --reuse -g name # rerun some tests against a kept setup
SHOTS=1 pnpm test:e2e         # also save screenshots for visual review
```

## What a run does

`tests/e2e/run.mjs` prepares everything, then calls Playwright:

1. Creates and migrates a local database (`E2E_DATABASE_URL`, by default
   `postgresql://postgres@127.0.0.1:55432/ndcak_e2e`). It refuses anything
   that is not on this computer.
2. Creates three throwaway accounts in Supabase Auth (`e2e-…@example.com`) and
   deletes them at the end, together with any left from an interrupted run.
3. Seeds the event through the app's own services (`tests/e2e/support/seed.vitest.ts`):
   five games, a realistic review queue, confirmed players, two knockout draws
   and a manual round, plus operator assignments.
4. Builds and starts the production app on port 3100. Every value the app
   would read from `.env.local` is overridden, except the Supabase keys, so a
   run can never reach the live database or send real email. A new setting in
   `.env.local` must be given an end-to-end value in `run.mjs`, which fails
   loudly until it is.
5. Starts a local SMTP sink on port 2526 (`tests/e2e/support/smtp-sink.mjs`).
   Tests read the messages it writes, including the calendar attachment.

Staff sign-in uses the real Supabase Auth project, because the app has no
other way to check a session. The throwaway accounts have staff profiles only
in the local database, so they can do nothing on the live site, and live
updates stay unavailable during a run (screens fall back to polling, which the
tests exercise).

## Coverage

| Area          | Checks                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Registration  | Phone-sized journey to the pending receipt, acknowledgment email, duplicate transaction ID refused, two students racing for the last place |
| Admin review  | Search, approve with calendar invite, reject with a reason and released places, double-clicked approval applied once                       |
| Operators     | Invitation email, password setup, assignment by game, only assigned matches visible, no access to admin pages or other matches             |
| Scoring       | Two operators on one match, typed score from a disconnected phone refused after the result is confirmed, winner advances, public results   |
| Accessibility | axe (WCAG 2.1 A and AA) on every public, admin and operator page at 390 and 1440 px                                                        |
| Keyboard      | Skip link, phone menu, pausing the highlights, registration completed without a mouse                                                      |
| Screen widths | 320, 390, 768, 1024 and 1440 px on every page, with no sideways scrolling                                                                  |
| Security      | Headers, robots, staff pages kept out of search, protected endpoints refuse anonymous requests, repeated failed sign-ins slowed down       |

The email design preview has its own run, because that page exists only in
development: `pnpm test:e2e:email`.
