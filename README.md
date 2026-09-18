# NDCAK Digital Tournament Management System

A clean, account-free participant experience and a controlled staff workspace for running the NDCAK Indoor Games from registration through results.

Phase 0 of the approved seven-phase roadmap is complete, and Phase 1 is underway. The repository includes the public experience foundation, live Supabase schema and staff-auth connection, a server-backed registration reader, and project quality tooling. Final participant submission remains intentionally disabled until committee-approved event and payment configuration is available.

## What is working

- Responsive public event landing page and information routes.
- Multi-game registration details form with shared Zod validation.
- Live Supabase tournament, capacity, and fee reads when registration is open.
- Browser-local draft review without creating a participant account.
- Applied Drizzle schema and migration for tournaments, registrations, payments, staff, assignments, matches, notifications, and audit logs.
- Supabase SSR client/server boundaries for future staff authentication.
- Live staff email/password login, verified SSR sessions, sign-out, and invite-token confirmation.
- Unit tests for fee, capacity, and participant-data normalization rules.
- Editable Mermaid architecture, data, authorization, and state-flow diagrams.

## Local setup

Requirements: Node.js 22+ and pnpm 12+.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The public prototype and connected staff login are available locally. `.env.local` is intentionally ignored and contains the development Supabase public credentials.

## Quality checks

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Database commands use the ignored `.env.local` connection:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
pnpm db:bootstrap-admin
```

## Project map

- `src/app` — routes, metadata, and page composition.
- `src/components` — shared presentation components.
- `src/features` — feature-owned UI and domain logic.
- `src/db` — Drizzle connection, schema, and generated migrations.
- `src/lib` — integration boundaries and shared utilities.
- `tests` — automated tests organized by test level and domain.
- `docs` — source PRD, full text extraction, architecture, research, roadmap, status, and quality standards.

Start with [`docs/README.md`](docs/README.md), then use [`docs/planning/STATUS.md`](docs/planning/STATUS.md) for current progress and [`docs/planning/EXTERNAL_ACCESS.md`](docs/planning/EXTERNAL_ACCESS.md) for the external setup still needed.

## Configuration boundary

`src/features/tournaments/fixtures/current-tournament.ts` is retained only for tests and design reference. Participant routes read the live database and show a closed state until an approved `REGISTRATION_OPEN` tournament is published. Production dates, games, fees, capacities, rules, payment accounts, and schedules must not be inferred from the fixture.
