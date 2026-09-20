# Documentation

## Running the platform

Start here if you are on the committee.

- [How the platform works](guide/README.md) — the whole thing in one page
- [Admin handbook](guide/ADMIN_GUIDE.md) — every section of the admin panel
- [Operator handbook](guide/OPERATOR_GUIDE.md) — score operators, from
  invitation to the final result
- [What students see](guide/PARTICIPANT_JOURNEY.md) — registration, payment
  and the emails
- [Event day runbook](operations/EVENT_DAY_RUNBOOK.md) — the day itself, and
  what to do when something breaks

## Building on it

- [Product brief](product/PRODUCT_BRIEF.md) — what the platform is for
- [System architecture](architecture/SYSTEM_ARCHITECTURE.md) — runtime
  boundaries and the major workflows
- [Data model](architecture/DATA_MODEL.md) — tables, invariants and indexes
- [State flows](architecture/STATE_FLOWS.md) — registration and match state
  machines
- [Authorization](architecture/AUTHORIZATION.md) — staff roles, assignment
  scopes and how access is resolved
- [Scoring and realtime](architecture/SCORING_AND_REALTIME.md) — concurrent
  score entry, the event log, live updates and the free-plan limits

## Operating it

- [Deployment](operations/DEPLOYMENT.md) — Vercel, environment variables, the
  daily job and the one dependency patch
- [Supabase](operations/SUPABASE.md) — connection modes, security boundaries,
  migrations
- [Email](operations/EMAIL.md) — Gmail SMTP and the App Password

## Quality

- [Quality bars](qa/QUALITY_BARS.md) — the gates every change has to pass
- [Integration tests](qa/INTEGRATION_TESTS.md) — the PostgreSQL suite
- [End-to-end tests](qa/END_TO_END_TESTS.md) — the browser suite

## Record

- [Project status](planning/STATUS.md) — where things stand, what the owner
  still has to do, and the decision log
- [Launch report](planning/LAUNCH_REPORT.md) — what the pre-launch rehearsal
  measured and the two problems it found

## House rules

These held throughout the build and should hold for anything added later.

- The [product brief](product/PRODUCT_BRIEF.md) is the authority on what the
  platform must do. Its non-negotiable rules are not style preferences.
- Dates, fees, capacities, rules, payment accounts and schedules are
  configuration, never code. Nothing is hardcoded and nothing is invented.
- Where a detail is not set yet, the site says so rather than showing a
  plausible sample.
- Material decisions, and the reason for each, are recorded in the decision
  log at the end of [`planning/STATUS.md`](planning/STATUS.md). Read it before
  changing something that looks odd; most oddities are load-bearing.
- Diagrams are Mermaid so their source stays reviewable.
- Logos and the images used in the root README are in
  [`assets/`](assets/README.md).
