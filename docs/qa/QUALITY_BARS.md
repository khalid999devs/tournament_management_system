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
- Public submission uses rate limiting and anti-bot controls before launch.

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

## Release gates

- Critical unit, integration, and end-to-end tests pass.
- Last-slot concurrency and stale-match conflict tests pass.
- Mobile registration and operator score entry pass viewport QA.
- Production-like rehearsal includes multiple operators and realistic data volume.
- Backup/restore and emergency administration procedures are documented and rehearsed.
