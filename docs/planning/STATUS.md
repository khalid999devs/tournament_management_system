# Implementation Status

Last updated: 19 September 2026

## Current phase

Phase 1 - Public Site and Registration. Phase 0 foundation is complete.

## Completed

- Reviewed all repository source artifacts.
- Extracted all 25 PRD pages into a searchable text artifact.
- Visually reviewed every PRD page and all supplied design/architecture assets.
- Researched comparable tournament products and multi-step form patterns.
- Scaffolded Next.js App Router with TypeScript, Tailwind CSS, and ESLint.
- Established the NDCAK design direction and first responsive public landing slice.
- Added branded Open Graph artwork and site metadata.
- Added core database, auth, form, validation, icon, formatting, and testing packages.
- Defined the seven-phase delivery plan and initial architecture documents.
- Defined all 16 initial database tables, constraints, indexes, row-level security activation, and generated migrations.
- Applied the initial migration to the live Supabase project through the IPv4 Transaction Pooler.
- Verified 16 public tables, RLS on all 16, 28 foreign keys, 66 indexes, and no missing foreign-key indexes.
- Kept the browser-facing Data API default-deny: no anonymous or authenticated RLS policies exist yet.
- Added environment validation and Supabase browser, server, and staff-route session boundaries.
- Connected the supplied Supabase project URL and publishable key through the ignored local environment.
- Verified the Supabase Auth API, Data API client path, and expected pre-migration schema state.
- Added staff email/password sign-in, verified SSR claims, sign-out, invite-token confirmation, and noindex metadata.
- Configured the official Super Admin and reply-to email identity.
- Added and validated the Resend SDK, server-only environment boundary, and email transport wrapper.
- Verified the Resend API key; no sending domain is currently configured.
- Generated and integrated compact and full NDCAK logo variants with corrected proportions.
- Added shared registration fee, capacity, validation, and normalization domain logic with unit tests.
- Built the participant details, game selection, review, and intentionally blocked payment routes.
- Replaced participant-route demo data with live, server-only Supabase tournament and game reads.
- Added schedule, rulebook, and results routes with honest pre-publication states.
- Verified formatting, type checking, linting, unit tests, and a production build.

## In progress

- First Auth user creation and Super Admin staff-profile bootstrap.
- Resend sender-domain verification and Supabase Auth SMTP dashboard configuration.
- Committee confirmation of event configuration and payment instructions.
- Server-authoritative registration submission and acknowledgment workflow.

## Next

1. Create the official email as a Supabase Auth user, then bind it to a Super Admin staff profile.
2. Verify an NDCAK-controlled sender domain and configure Supabase Auth SMTP.
3. Replace development tournament fixtures with approved event, game, and payment configuration.
4. Complete the atomic registration-submission transaction and pending acknowledgment.
5. Start the Phase 2 administration queue after the Phase 1 exit criteria pass.

## Decision log

| Date       | Decision                                                                                 | Reason                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-09-19 | Keep the PRD stack: Next.js, Supabase PostgreSQL/Auth/Realtime, Drizzle, Resend, Vercel. | It matches the approved product direction and the relational/concurrency requirements.                   |
| 2026-09-19 | Treat the participant journey as account-free and staff routes as authenticated.         | This is the central experience boundary in the PRD.                                                      |
| 2026-09-19 | Use one feature-oriented monolith.                                                       | It keeps transactional workflows cohesive without premature infrastructure.                              |
| 2026-09-19 | Use deterministic Mermaid architecture diagrams and a single generated social asset.     | Technical diagrams need exact, editable labels; the social card benefits from original visual treatment. |
| 2026-09-19 | Do not hardcode event fees, dates, capacities, schedules, or payment accounts.           | The committee has not finalized them and the PRD explicitly requires configuration.                      |
| 2026-09-19 | Keep participant database access behind server actions with default-deny RLS.            | It avoids exposing payment and registration mutations directly to anonymous clients.                     |

## Known blockers

The official Super Admin email does not yet exist in Supabase Auth, so its application profile cannot be created safely. Resend is connected, but production sending and Supabase Auth SMTP require a verified sender domain. Enabling participant payment instructions still requires committee-approved payment methods and receiving accounts. See `EXTERNAL_ACCESS.md` for the complete request list.
