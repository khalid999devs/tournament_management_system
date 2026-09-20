<div align="center">

# Game Tournament Management System

**Run an offline game competition end to end, from the first entry to the
final bracket.**

Built for clubs that hold their tournaments in a room rather than online:
chess boards, carrom, table tennis, a row of phones for a Free Fire lobby.
Players enter several games at once, organisers verify who is in, and score
operators run the matches from their phones on the day.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791.svg)](https://www.postgresql.org)

[Live site](https://ndcak-indoor-games.vercel.app) ·
[Documentation](docs/README.md) ·
[Admin handbook](docs/guide/ADMIN_GUIDE.md) ·
[Report a bug](https://github.com/khalid999devs/tournament_management_system/issues)

</div>

![The home page](docs/assets/screenshots/home.png)

---

## Why this exists

An offline tournament is mostly logistics. The games take care of themselves;
what breaks is everything around them. A few hundred entries arrive through
a form nobody can search. Nobody is sure who has actually paid. On the day,
a dozen volunteers walk around with phones on venue wifi that drops, writing
scores on paper because the app they were given needs a signal, and by the
evening two people disagree about who won a quarter-final.

This platform is built for that day. Entries are searchable and
account-free, so a player never makes a password for a one-afternoon event.
Every match is scored from a phone, and a phone that loses signal keeps
working and catches up by itself. Two operators on the same match cannot
overwrite each other. Every score change is kept, with who made it, so a
disputed result has an answer.

Entry fees are handled the way clubs actually collect them: players pay by
mobile banking and submit the transaction reference, and an organiser
verifies it against the statement. That is deliberate. Where money arrives by
hand, software should record the check rather than pretend a gateway made it.

## Features

**For players** — No account, no app. Fill in your details, pick any games
you want, pay the total once, and enter the transaction ID. Your place is held
while the committee checks the payment, and the confirmation email carries a
calendar invite.

<img src="docs/assets/screenshots/register-phone.png" alt="Registration on a phone" width="300">

**For the committee** — One workspace for the whole event: a verification
queue with every payment detail, event and game settings, draws, a live match
monitor, problem reports from the floor, five CSV exports and a log of every
email sent.

![The admin dashboard](docs/assets/screenshots/admin-dashboard.png)

![The registration queue](docs/assets/screenshots/admin-registrations.png)

**For score operators** — Each operator sees only the matches they were
given, with a scoring screen built for the game in hand. Scores entered
without signal wait on the phone and send themselves; two operators on one
match can never overwrite each other silently.

<img src="docs/assets/screenshots/operator-score-phone.png" alt="Score entry on a phone" width="300">
<img src="docs/assets/screenshots/operator-list-phone.png" alt="An operator's match list" width="300">

**In public** — Schedule, rulebook and, once the committee publishes them,
results and brackets.

![Results and brackets](docs/assets/screenshots/results.png)

### In detail

| Area              | What you get                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Registration**  | Account-free, multi-game, fees and capacity calculated on the server, duplicate entries and reused transaction IDs refused, drafts kept on the device   |
| **Payments**      | Instructions per method, manual verification, approval or rejection with a reason, capacity released on rejection                                       |
| **Staff access**  | Super Admin and score operators, email invitations, access by tournament, game, round, match or player, at three levels                                 |
| **Scoring**       | Seven scoring types, from head-to-head to 100-player lobbies; knockout draws with byes, or manual rounds; corrections, walkovers and a full match log   |
| **Reliability**   | Every action idempotent, scores an append-only log with per-match versions, an offline queue on the phone, stale updates refused with the current state |
| **Live updates**  | Staff screens update in about a second over private Supabase Realtime channels, with polling underneath so nothing depends on the socket                |
| **Communication** | Registration, approval, rejection, invitation and reminder emails, all recorded and retryable                                                           |
| **Reporting**     | Dashboard counted from the database, plus CSV exports for registrations, players, payments, results and operator activity                               |
| **Operations**    | Daily scheduled job, health endpoint, backups with a verified restore, emergency admin access, an event-day runbook                                     |
| **Accessibility** | WCAG 2.1 AA checked on every page at two widths, full keyboard operation, no sideways scrolling from 320 px up                                          |

## Built with

[Next.js 16](https://nextjs.org) (App Router, React 19) and TypeScript, with
PostgreSQL on [Supabase](https://supabase.com) through
[Drizzle ORM](https://orm.drizzle.team). Supabase Auth holds staff sessions
and Supabase Realtime carries live updates. Email goes out over Gmail SMTP,
because a student club has no domain to verify with an email provider.
Deployed on [Vercel](https://vercel.com).

It runs inside the free tier of both Supabase and Vercel, which was a design
constraint rather than an afterthought. See
[scoring and realtime](docs/architecture/SCORING_AND_REALTIME.md) for how the
concurrency model fits in that budget.

## Getting started

You need Node 24, pnpm 12, a Supabase project for staff sign-in, and a local
PostgreSQL if you want to run the tests.

```bash
git clone https://github.com/khalid999devs/tournament_management_system.git
cd tournament_management_system
pnpm install

cp .env.example .env.local        # fill in Supabase, database and email
pnpm db:migrate                   # create the schema
pnpm db:invite-admin -- --local --print   # a link to set the admin password

pnpm dev                          # http://localhost:3000
```

`pnpm readiness:check` reports anything still missing, without changing data
or sending email.

From there, [the admin handbook](docs/guide/ADMIN_GUIDE.md) walks through
setting up an event: dates and venue, games and fees, payment numbers, then
opening registration.

## Testing

```bash
pnpm test              # 116 unit tests, no database needed
pnpm test:integration  # 59 tests against a local PostgreSQL
pnpm test:e2e          # 39 browser tests
pnpm typecheck && pnpm lint
```

The browser suite builds the app, seeds a local database through the app's own
services, starts a local mail sink and drives real flows: registration, admin
review, operator invitations and access, two operators on one match,
accessibility, keyboard-only use, five screen widths and the security headers.
It never touches a live database and never sends real email; the only live
service it uses is Supabase Auth, through throwaway accounts it deletes
afterwards. Details in [docs/qa/](docs/qa/END_TO_END_TESTS.md).

## Deploying

```bash
pnpm vercel:env        # copy production settings from .env.local
vercel deploy --prod
```

[docs/operations/DEPLOYMENT.md](docs/operations/DEPLOYMENT.md) covers the
environment variables, the daily cron job and the one patched dependency, and
explains why it is patched.

## Project layout

```
src/app         pages and routes (public, admin, operator, staff, API)
src/features    the work itself: registration, admin, operators, matches,
                scoring, notifications, issues, analytics, event settings
src/db          schema and migrations
src/lib         database client, email, realtime signals, rate limits
tests           unit, integration and browser tests
docs            handbooks, architecture, operations, QA and the decision log
scripts         backups, admin access, readiness and deployment helpers
```

Each feature folder keeps its own `domain` (pure rules, unit-tested),
`server` (transactions and queries) and `components`. Business rules live in
`domain` so they can be tested without a database, and every privileged action
re-checks authorization on the server.

## Documentation

- **Running an event** — [how the platform works](docs/guide/README.md), the
  [admin handbook](docs/guide/ADMIN_GUIDE.md), the
  [operator handbook](docs/guide/OPERATOR_GUIDE.md),
  [what students see](docs/guide/PARTICIPANT_JOURNEY.md) and the
  [event day runbook](docs/operations/EVENT_DAY_RUNBOOK.md)
- **Understanding the code** —
  [architecture](docs/architecture/SYSTEM_ARCHITECTURE.md),
  [data model](docs/architecture/DATA_MODEL.md),
  [state flows](docs/architecture/STATE_FLOWS.md),
  [authorization](docs/architecture/AUTHORIZATION.md),
  [scoring and realtime](docs/architecture/SCORING_AND_REALTIME.md)
- **Why it is like this** — the decision log at the end of
  [docs/planning/STATUS.md](docs/planning/STATUS.md) records every material
  decision and its reason. Read it before changing something that looks odd.

## Contributing

Issues and pull requests are welcome, particularly from other university clubs
adapting this for their own events.

- Open an issue first for anything substantial, so we can agree on the shape
  before you spend time on it.
- Run `pnpm typecheck && pnpm lint && pnpm test` before opening a pull
  request. Touching registration, payments, scoring or access also means
  `pnpm test:integration`.
- Match the surrounding code, and keep business rules in `domain` where they
  can be tested without a database.
- User-visible copy is plain English, written for a player or a volunteer
  rather than a developer.
- Never commit secrets, real participant data or a database dump.

[docs/qa/QUALITY_BARS.md](docs/qa/QUALITY_BARS.md) lists the bars a change has
to clear.

## Adapting it for your own event

Nothing about the games, fees, dates, venue, payment methods or rules is
hardcoded; it is all configuration you enter in the admin panel. To run your
own tournament you mainly need to change the branding in `public/brand`, the
association name and contact address, and the seven scoring types if your
games need something the existing ones cannot express.

## License

[MIT](LICENSE) © 2026 Khalid Ahammed Uzzal

## Credits

Built for the **Notre Dame College Association of KUET** by
[Khalid Ahammed Uzzal](https://khalidahammed.com), Organizing Secretary and
full stack engineer. The people behind it are listed on the
[developers page](https://ndcak-indoor-games.vercel.app/developers), which is
driven by a single JSON file rather than an admin screen.

Screenshots on this page come from the demo data the test suite seeds, never
from real participants.
