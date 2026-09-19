# Phase 1 and Phase 2 Completion Record

Completed: 19 September 2026

## Phase 1 - Public Site and Registration

| Exit criterion                                                             | Evidence                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A mobile participant can select multiple configured games and submit once. | `/register`, `/register/review`, `/register/payment`, and `/register/submitted` form one responsive, account-free flow. A browser-stored UUID provides submission idempotency.                                                                                          |
| Fee and capacity logic is shared, server-authoritative, and tested.        | `calculateRegistrationQuote` is reused by UI review and server submission. The server reloads and locks current game rows, recomputes fees, and performs guarded capacity updates. Unit coverage includes fee, availability, selection limits, and full/closed games.   |
| Final submission is atomic and cannot oversubscribe.                       | Participant upsert, registration, guarded reservations, entries, payment snapshot, notification outbox, and audit record are committed in one transaction. Tournament-game rows are locked in deterministic ID order and every capacity increment has a database guard. |
| Duplicate active registration and provider transaction rules are enforced. | Partial unique active-registration and normalized provider/transaction indexes remain authoritative. Friendly domain errors map both conflicts.                                                                                                                         |
| Submitted state and email consistently say pending review.                 | The submitted route and `REGISTRATION_SUBMITTED` email explicitly say the registration is pending and not confirmed. Submission email has no calendar attachment.                                                                                                       |

## Phase 2 - Admin Verification

| Exit criterion                                                                     | Evidence                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin can search, filter, sort, and paginate server-side without losing URL state. | `/admin/registrations` queries PostgreSQL with server-side search; status, game, department, payment, and date filters; deterministic sorting; 25-row pages; reset and empty states. Every control and page link uses URL query parameters.                                                                                              |
| Approval and rejection are idempotent, atomic, and audited.                        | Every action re-resolves the authenticated Super Admin. The transaction locks the registration, entries, and game counters; checks current state; updates all related records; writes an immutable audit entry; and treats a repeated same decision as a no-op.                                                                          |
| Rejection releases capacity; approval finalizes it.                                | Rejection moves reserved count down and rejects payment/entries. Approval moves one unit from reserved to confirmed for every selected game and verifies payment. Counter updates require an existing reservation or the transaction rolls back.                                                                                         |
| Email failures do not roll back database state and can be retried.                 | External delivery runs after commit. Provider failures update the notification to `FAILED`; registration state remains unchanged. `/admin/notifications` exposes delivery status, attempts, safe error text, and retry for failed/queued messages. Each message is claimed in the outbox before sending, which prevents duplicate sends. |

## Additional Phase 2 deliverables

- Verified Supabase claim plus active application-profile authorization on every admin page and mutation.
- Dashboard counts for pending, confirmed, rejected, and total registrations.
- Full manual payment-evidence review with receiving-account snapshot and transaction ID.
- Participant-safe rejection reason validation.
- Approval email with selected games, check-in information, schedule, venue, and generated `.ics` calendar invitation.
- Notification list with server-side recipient search, status filter, sort, and pagination.
- Audit records for participant submission and every registration decision.

## Verification record

- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` - 7 files, 19 tests passed
- `pnpm build` - production build passed
- Production server smoke check: `/register` returned `200` against the live Supabase connection.
- Authorization smoke check: unauthenticated `/admin` returned `307` to `/staff/login`.
- Live data check: schema reachable; no tournament, payment, staff-profile, or registration records have been fabricated.

## Activation boundary

The code phase is complete. Live acceptance with real participant/admin data waits on the user-owned configuration listed in `EXTERNAL_ACCESS.md`; those values are not safe to infer from design references or prototype screenshots.
