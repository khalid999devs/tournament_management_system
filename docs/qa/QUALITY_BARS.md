# Quality Bars

## Code quality

- Strict TypeScript; avoid `any` at domain and external-input boundaries.
- Feature modules own their schemas, server services, components, and tests.
- Page components compose features and do not contain business rules.
- Short, precise comments only when intent cannot be expressed by names and structure.
- No generic dumping-ground utility module.
- Lint, format check, type check, unit tests, and production build run in CI.

## Data integrity

- Migrations are committed and repeatable.
- Capacity, approval/rejection, match finalization, progression, and correction use transactions.
- Critical commands are idempotent or guarded by expected state.
- Match writes enforce optimistic concurrency.
- Audit logs are append-only to normal application users.

## Security

- Secrets remain server-only and are validated on startup/use.
- Staff routes authenticate on the server and are `noindex`.
- Every external input is validated server-side.
- Every operator query/mutation applies effective scope.
- Logs exclude raw secrets and unnecessary participant/payment data.
- Public submission and staff sign-in are limited by attempt counters in the database (Phase 6).

## UX and accessibility

- Public and operator flows are mobile-first; admin remains usable on mobile.
- Primary actions remain clear at every step.
- Forms have persistent labels, actionable errors, and preserved values after recoverable failures.
- Keyboard, focus, contrast, touch-target, and reduced-motion checks pass.
- Loading, empty, error, conflict, and success states are intentional.

## Performance

- Public content is statically rendered or revalidated where appropriate.
- Staff lists select only required fields and paginate on the server.
- Growing lists never fetch the full dataset for browser-only filtering.
- Images have explicit dimensions and appropriate optimization.
- Realtime subscriptions are limited to authenticated staff workflows.

## Continuous integration

`.github/workflows/checks.yml` runs on every pull request and every push to
`main`:

| Job             | Runs                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| **static**      | Route typegen, `typecheck`, `lint`, `format:check`, unit tests                      |
| **integration** | Migrations, then the PostgreSQL suite against a throwaway container                 |
| **build**       | Migrations, then a production build, since public pages prerender from the database |

Route and layout prop types are generated rather than committed, so `next
typegen` runs before `tsc`.

**The browser suite is not in CI.** Staff sign-in has no way to check a
session without a real Supabase Auth project, and putting those keys in a
public repository's workflow is not worth the convenience. Run it locally with
`pnpm test:e2e` before a change that touches a page.

No job uses a secret: the database is a service container with trust
authentication and the Supabase values are placeholders.

## Release gates

- Critical unit, integration, and end-to-end tests pass.
- Last-slot concurrency and stale-match conflict tests pass.
- Mobile registration and operator score entry pass viewport QA.
- Production-like rehearsal includes multiple operators and realistic data volume.
- Backup/restore and emergency administration procedures are documented and rehearsed.
