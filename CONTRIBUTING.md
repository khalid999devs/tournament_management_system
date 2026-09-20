# Contributing

Thanks for taking an interest. This project runs real tournaments with real
entry fees, so the rules below are stricter than a weekend project's. They
exist because a bug here means a student loses their place or a result is
wrong in front of a room of people.

Read [`docs/guide/README.md`](docs/guide/README.md) first if you have never
run an event on the platform. It is short, and most design decisions only make
sense once you know what event day looks like.

## Ways to help

- **Bug reports.** The most useful thing you can send. See
  [Reporting a bug](#reporting-a-bug).
- **Documentation.** If something in `docs/` was wrong or missing when you
  needed it, fix it. This needs no permission.
- **Adapting it for your own club.** Changes that make the platform less
  specific to one association are welcome, as long as they do not make the
  common case harder.
- **New scoring types.** The seven that exist cover most indoor games. A new
  one is a well-scoped contribution: see
  [Adding a scoring type](#adding-a-scoring-type).

Open an issue before starting anything substantial, so we can agree on the
shape before you spend an evening on it. Small fixes can go straight to a pull
request.

## Getting set up

You need Node 24, pnpm 12, a Supabase project (staff sign-in needs a real Auth
project, even locally) and a local PostgreSQL for the tests.

```bash
pnpm install
cp .env.example .env.local        # fill in Supabase, database and email
pnpm db:migrate
pnpm db:invite-admin -- --local --print
pnpm dev
```

`pnpm readiness:check` tells you what is still missing without changing data
or sending email.

For the integration and browser suites you also need a local PostgreSQL on
port 55432. [`docs/qa/INTEGRATION_TESTS.md`](docs/qa/INTEGRATION_TESTS.md) has
the four commands.

## The workflow

`main` is protected. Nobody pushes to it directly, including the maintainer.
Every change arrives as a pull request.

```bash
git checkout -b fix/short-description
# work, commit
git push -u origin fix/short-description
gh pr create
```

Branch names are `fix/`, `feat/`, `docs/` or `chore/` followed by a few words
with hyphens.

Before you open the pull request:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

If you touched registration, payments, scoring, brackets or operator access,
also run `pnpm test:integration`. If you touched a page, `pnpm test:e2e`.

Pull requests should be one change. If you find an unrelated problem on the
way, note it in an issue rather than folding it in; a reviewer who has to hold
two ideas at once catches less.

### Commit messages

Write the subject as an instruction to the codebase, under about 70
characters, with no full stop:

```
Show only current access, and filter without reloading the page
```

Then a body that explains **why**, not what the diff already shows. State the
problem, then the fix. Most of the commits in this repository follow that
shape; `git log` is a good reference.

Reference an issue with `Fixes #12` on its own line when one applies.

## Architecture rules

These are not style preferences. Breaking them is how this kind of software
starts losing data.

**Business rules live in `domain`.** Each feature folder has `domain` (pure
functions, no database, unit-tested), `server` (transactions, queries, server
actions) and `components`. If a rule can be tested without a database, it
belongs in `domain`.

**Pages compose, they do not decide.** A page component reads data and renders
it. No fee calculation, no eligibility check, no bracket logic in a page.

**Authorize on the server, every time.** Never rely on a hidden field, a
disabled button or a client check. Every privileged action re-reads the actor's
role and scope inside the request that performs it.

**Money, capacity and results move in transactions.** Approving a
registration, finalizing a match and advancing a winner each touch several
tables. All of it commits together or none of it does.

**Anything a phone might retry must be idempotent.** Network requests get sent
twice. A repeated submit, approval or score must apply once. Use an
idempotency key, a unique constraint, or an expected-version check.

**Match writes use optimistic concurrency.** Two operators on one match is
normal, not an edge case. A write that replaces state carries the version it
saw and is refused if the version moved, with the current state returned.

**Never trust the client for anything that costs money or a place.** Fees,
capacity, the registration window and payment methods are all recalculated on
the server at submission time.

## Database changes

Edit the schema in `src/db/schema/`, then generate a migration:

```bash
pnpm db:generate
```

Rename the generated file to something a human can read
(`0005_one_assignment_per_target.sql`, not `0005_peaceful_odin.sql`) and
update the tag in `src/db/migrations/meta/_journal.json` to match.

If the migration has to clean up existing rows, put that in the same file,
before the schema change, with a comment explaining the rule you chose. Test
it against a scratch database with data that actually breaks: duplicates,
nulls, rows in the wrong state.

Never edit a migration that has already been applied anywhere. Add another.

## Testing

| Suite                   | Runs against         | Use it for                                          |
| ----------------------- | -------------------- | --------------------------------------------------- |
| `pnpm test`             | nothing              | Domain rules, pure functions, formatting of output  |
| `pnpm test:integration` | local PostgreSQL     | Transactions, constraints, concurrency, permissions |
| `pnpm test:e2e`         | a built app + Chrome | Whole journeys, accessibility, layout, security     |

**Integration tests only ever run against a local database.** The setup
truncates every table and refuses a non-local host. Never point them at
Supabase.

A bug fix comes with a test that fails without the fix. A new rule comes with
a test for the case it forbids, not only the case it allows.

Write tests against what a person sees or a table contains, not against
internal call order. In browser tests, find things by their role and visible
name, the way a person would.

## Interface and copy

The full list is [`docs/qa/QUALITY_BARS.md`](docs/qa/QUALITY_BARS.md). The
ones people get wrong:

- **Plain English, written for a player or a volunteer.** Not "invalid scope
  target", but "That choice does not belong to the tournament."
- **No em dashes in user-visible copy.** Use a comma, a colon or a full stop.
- **Say what is true.** Where a detail is not configured yet, the page says
  so. Never invent a date, a fee or a fixture, and never ship sample data that
  a visitor could mistake for real.
- **Every state is designed**: loading, empty, error, conflict and success. An
  empty list explains why it is empty and what to do.
- **It works at 320 px** with no sideways scrolling, and on a phone in a hall
  with bad wifi.
- **It works from the keyboard**, with visible focus, and passes WCAG 2.1 AA.
  The browser suite runs axe over every page at two widths.
- **Touch targets are at least 44 px** on anything an operator taps mid-match.

## Security

- **Never commit a secret**, a real participant's details, or a database dump.
  `.env*`, `backups/` and `test-results/` are ignored; keep it that way.
- Secrets are server-only. Anything named `NEXT_PUBLIC_` is visible to the
  world, so treat it as public.
- Staff pages stay `noindex` and authenticate on the server.
- Logs never carry raw secrets, payment references or contact details.
- Operator queries always apply the operator's effective scope. An operator
  must never be able to read payment data, in any query, by any route.

Found a vulnerability? Do not open a public issue. Email
**khalidahammeduzzal@gmail.com** with what you found and how to reproduce it,
and give a reasonable window for a fix before disclosing.

## Adding a scoring type

A scoring type is an adapter in `src/features/scoring/adapters/`. It declares
how many competitors a match holds, what settings an admin configures, which
live events an operator can record, how to rank the result, and how to print
the score. To add one:

1. Write the adapter with its settings schema and ranking rules.
2. Register it in `src/features/scoring/adapters/index.ts`.
3. Add its panel in `src/features/matches/components/score-panels.tsx`. Design
   it for a thumb on a phone, not a mouse.
4. Unit-test the ranking, including ties and the states it must refuse.
5. Add it to the table in
   [`docs/guide/ADMIN_GUIDE.md`](docs/guide/ADMIN_GUIDE.md) so an organiser
   knows when to pick it.

Say clearly whether it progresses by knockout or manual rounds. Automatic
brackets are head-to-head only; anything with more than two competitors per
match uses manual rounds.

## Reporting a bug

Include:

- what you did, what happened, and what you expected instead;
- the page, and whether you were a participant, an admin or an operator;
- the browser and whether you were on a phone;
- anything in the match log, the audit log or the browser console.

"The score did not save" is hard to act on. "Two of us scored match
CHESS-R1-M3 at once on phones, and the second person's point vanished after a
refresh" can be fixed.

## Code of conduct

Be decent. Assume the other person is trying to help and is short of time.
Critique the code, never the person. Harassment of any kind, in issues, pull
requests or commit messages, gets you removed without discussion.

## License

By contributing you agree that your work is released under the
[MIT License](LICENSE) that covers this project.
