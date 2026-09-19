# Scoring, Concurrency and Realtime Design (Phases 4–5)

Design for live score entry by several operators at once, with no lost, duplicated or silently overwritten updates, on the **free** Supabase and Vercel plans.

**Status:** Phase 4 (everything except the Realtime section) is implemented and verified; see `docs/planning/PHASE_4_COMPLETION.md`. Phase 5 adds Realtime.

## Constraints

Checked against the provider docs in September 2026.

| Limit                   | Free value                                                     | Consequence                                                                                     |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Supabase database       | 500 MB, shared CPU, 500 MB RAM                                 | Keep writes small; store one row per score event, not snapshots of whole matches.               |
| Supabase pooler clients | 200                                                            | Each Vercel instance holds at most 3 connections; transactions stay under ~50 ms.               |
| Supabase Realtime       | 200 concurrent connections, 100 messages/s, 2 M messages/month | Realtime is for staff only; public pages use cached reads. Subscriptions are scoped per match.  |
| Supabase pausing        | Paused after 7 days without activity                           | A daily Vercel cron touches the database (see below).                                           |
| Vercel Hobby functions  | 300 s max, 4 h active CPU and 1 M invocations per month        | Score commands are short; CPU is spent only while code runs, not while waiting on the database. |
| Vercel Hobby cron       | Once per day, ±59 min                                          | No frequent background jobs; retries run on demand or via Supabase `pg_cron`.                   |
| Vercel Hobby use        | Non-commercial only                                            | See **Open risk** below.                                                                        |

An event day is expected to have about 20 operators, 2–5 admins, a few hundred matches and a few thousand score events. That is under 5% of any limit above.

## Principles

1. **PostgreSQL decides.** Every score change is a server command that runs in one short transaction. Realtime and client state are only views of it.
2. **Every change is an event.** Each accepted command appends one row to `match_updates`; its `match_version` is the per-match sequence number. The current score on `matches` is derived from those events and updated in the same transaction.
3. **Nothing is applied twice.** Each command carries a client-generated `clientEventId` (UUID) with a unique index. A retry after a timeout returns the original result instead of applying the change again.
4. **Nothing is silently overwritten.** Commands that _set_ state carry the `expectedVersion` the operator saw. A stale version is rejected with the current state, never merged blindly.
5. **Order and timing are preserved.** The server records its own commit time and sequence. The operator device's time is stored alongside, for display and review only, never for ordering.

## Command model

| Command                                                 | Kind                       | Concurrency rule                                                                                                  |
| ------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `startMatch`                                            | state change               | Requires `expectedVersion`; only from `SCHEDULED`.                                                                |
| `recordScoreEvent` (goal, point, set won, board result) | **delta**                  | Serialized by a row lock; never conflicts, because two operators recording two goals means two goals.             |
| `correctScoreEvent` (void a previous event)             | delta referencing an event | Allowed while `IN_PROGRESS`; the voided event stays in history.                                                   |
| `setScore` (type the full score)                        | state change               | Requires `expectedVersion`; rejected if anyone else changed the match first.                                      |
| `finalizeMatch`                                         | state change               | Requires `expectedVersion`; validates with the game's scoring adapter; writes placements and bracket progression. |
| `reopenMatch`                                           | admin only                 | Requires a reason; blocked if a later match that depends on it has started.                                       |

Every command runs this transaction:

```text
BEGIN
  select … from matches where id = $match for update          -- serializes writers on one match
  if exists match_updates.client_event_id = $clientEventId    -- idempotent retry
     return stored result
  authorize operator scope + capability (same predicate as the workload query)
  if command needs expectedVersion and matches.version <> $expectedVersion
     return STALE_MATCH_VERSION + current state             -- no write
  validate payload with the scoring adapter
  insert match_updates (match_version = version + 1, created_at = clock_timestamp(), device_time, client_event_id, payload)
  update matches set score/result, version = version + 1
  on finalize: write match_entries placements, lock + fill next match slot, audit_logs row
COMMIT
```

Locks are always taken in one order (current match, then the next-round match), so concurrent finalizations cannot deadlock. Each transaction touches one or two match rows, so contention exists only between operators on the same match, and the row lock queues them for milliseconds.

## Schema changes (Phase 4 migration, applied)

- `match_updates`: `client_event_id uuid` (unique), `device_time timestamptz`, `voids_update_id uuid` (unique, so an event can be undone once), and a unique index on `(match_id, match_version)`. `created_at` uses `clock_timestamp()` so updates in one transaction still get distinct times.
- `matches`: `score_json jsonb` holds the live score; `result_json` keeps the final canonical result.
- Scoring adapters live in `src/features/scoring/adapters/`: `CHESS_OUTCOME`, `GOALS`, `SETS`, `CARROM_POINTS`, `MULTIPLAYER_POINTS`, `SCORE_COMPARE` and `PLACEMENT_POINTS`. Each exports a settings schema, an event schema, a pure `applyEvent(score, event)` reducer and a `finalize(score)` that returns the PRD result. Settings are stored per game in `tournament_games.config_json`. The same code runs in the browser for instant feedback and on the server for authority. A new kind of game needs one new adapter file.
- Undoing an event appends a `SCORE_VOIDED` row and rebuilds the score from the log; if the rebuild would be impossible, the undo is refused and the operator types the corrected score instead.

## Operator device behaviour on weak networks

- Each action gets a `clientEventId` and goes into a small outbox in `localStorage`, so it survives a reload.
- The UI shows every action as _sending_, _saved_ or _needs attention_. Nothing is shown as saved until the server confirms.
- Failed sends retry with backoff using the same `clientEventId`, so a retry after a lost response cannot double-count.
- A `STALE_MATCH_VERSION` response shows the other operator's change and asks the operator to confirm again. Delta events never hit this path.
- Score entry works without realtime. Realtime only speeds up seeing other operators' changes. Until Phase 5, open score screens poll every 6 seconds; the server answers "unchanged" from one indexed lookup.
- Only one browser tab per operator and match sends the queue (Web Locks), so tabs never race each other.

## Realtime (Phase 5)

- **Transport:** Supabase Realtime **Broadcast from the database**. After a score event commits, a trigger on `match_updates` calls `realtime.send` with a small payload (`matchId`, `seq`, `version`, derived score) to private topics `match:<id>` and `tournament:<id>:matches`.
- **Authorization:** private channels with RLS policies on `realtime.messages` that reuse the operator-scope rules; payment data never enters a payload.
- **Clients:** the operator screen subscribes only to its open match. The admin monitor subscribes to the tournament topic. A client ignores messages whose `seq` it already has, and refetches if it sees a gap or reconnects.
- **Budget:** about 3,000 events × ~10 subscribers per event gives roughly 30,000 messages for the whole event, against 2 M a month. Peak rate stays under 100 messages/s because each match has 1–3 subscribers.
- **Public pages:** no sockets. Results and brackets are cached reads refreshed on demand (`revalidateTag`) when a match finalizes, as the PRD requires.

## Background work without frequent cron

- **Emails** keep sending post-commit through `after()`. Stuck `QUEUED` or `FAILED` messages are retried from `/admin/notifications`, plus a daily sweep.
- **Daily Vercel cron** (`/api/cron/daily`, protected by `CRON_SECRET`): sends event reminders, sweeps stuck notifications, and runs one cheap query that keeps the Supabase project from pausing.
- **Supabase `pg_cron`** (free) is the fallback if something must run more often than daily. It stays in the database and needs no paid Vercel plan.

## Verification

Done in Phase 4 (details in `PHASE_4_COMPLETION.md`):

- **Integration tests on local PostgreSQL:** ten parallel deltas produce ten events with versions 2–11; three racing retries of one `clientEventId` apply once; a finalize racing a typed score yields one success and one `STALE_MATCH_VERSION`; sibling semi-finals finishing together both land in the final without deadlock; reopen withdraws the advanced winner and is refused once the next match starts.
- **Load rehearsal:** 20 operators × 5 matches, about 42 requests per second for 60 seconds, 10% duplicate resends. All requests succeeded, p95 20 ms, and the database matched every accepted event exactly.
- **Crash test:** the server was killed and restarted mid-load; retries with the same ids landed every event exactly once.

Still to do in Phase 6: repeat the rehearsal against the deployed site and the Supabase pooler, and drop Realtime during scoring.

## Open risk: Vercel Hobby commercial-use rule

Vercel's Hobby plan is for non-commercial use, and its guidelines list "any method of requesting or processing payment from visitors" as commercial. This platform collects entry fees by bKash, Nagad or Rocket, even though payment happens outside the site. Before launch, NDCAK should either confirm with Vercel support that a non-profit student association event qualifies, or host on a free platform without that rule. Cloudflare Workers can run Next.js through the OpenNext adapter. The app uses standard Next.js features (server actions, `after()`, tagged caching) that OpenNext supports, so moving would mean adapter and cron configuration, not a rewrite.
