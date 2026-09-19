# Phase 4 Completion Record - Matches and Scoring

Completed: 19 September 2026

## Exit criteria

| Exit criterion                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supported games use adapter-specific forms and server validation.                     | Seven scoring types in `src/features/scoring/adapters/`, each with a settings schema, event schema, pure reducer and `finalize` that returns the PRD 10.4 result. The same code checks taps on the phone and decides on the server. The score screen has a panel for each type. 48 unit tests cover every type's rules and edge cases.                                                                                                                                                  |
| Two or more operators can work safely without stale overwrites.                       | Every command locks the match row and appends one `match_updates` row with the next version. Deltas (a goal, a point, a hand) never conflict. Typed scores, finalizing and walkovers carry the version the operator saw and are refused with `STALE_MATCH_VERSION` if anything changed. Single-field entries (a time, a finishing place, a tie-break order) carry the previous value. Integration tests race ten deltas, three retries of one id, and a finalize against a typed score. |
| Single-elimination progression supports byes; manual progression remains available.   | `buildSingleElimination` seeds a standard bracket, gives byes to top seeds and places them directly in round two. Finalizing moves the winner into the next match's seat inside the same transaction. Manual games have admin-built rounds and matches with any number of players. Tested for 2–64 players and in the browser.                                                                                                                                                          |
| Completed result correction is controlled and downstream dependencies are reconciled. | Only admins can reopen, with a reason stored in the audit log. Reopening withdraws the advanced winner from the next match in the same transaction, and is refused with `DOWNSTREAM_RESULT_DEPENDENCY` once that match has started. Tested end to end, including re-advancing the corrected winner.                                                                                                                                                                                     |

## Scoring types

| Type                    | Use                                 | Settings                                                                       |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| Win / draw / loss       | Chess, board games                  | Draws may stand (manual games only); knockout draws need a tie-break winner    |
| Goals                   | eFootball, foosball                 | Extra time, penalties, draws                                                   |
| Best-of sets            | Table tennis, badminton, volleyball | Best of 1/3/5/7, points per set, win by 2, point cap, deciding-set target      |
| Boards and points       | Carrom, pool                        | Points target, board limit, most points per board; tie-break boards when level |
| Multi-player points     | 29 Cards, Ludo                      | Highest or lowest wins, finishing total, negative totals, shared places        |
| Highest or lowest score | Time trials, Scrabble               | Direction, decimals, unit, shared places                                       |
| Placement points        | PUBG, Free Fire                     | Points per finishing place, points per elimination                             |

Settings are edited on each game's page and freeze when the first match of that game starts. Scoring type and progression freeze once a draw exists.

## Reliability evidence

- **Load rehearsal** against a local production build: 20 simulated operators on 5 matches for 60 seconds. 2,571 requests at 42 per second, 228 of them deliberate duplicate resends. All succeeded, p50 8 ms, p95 20 ms, maximum 99 ms. Afterwards every match had exactly as many score events as accepted ids, contiguous versions, and totals equal to what was sent.
- **Crash test**: the server was killed at second 12 of a 40-second run and restarted 6 seconds later. 105 requests failed and were resent with the same ids; 1,259 events landed exactly once with correct totals.
- **Browser walkthrough** at 1440 px (admin) and 390 px (operator, touch): draws, a chess result, reopen and correction, a manual 29 Cards table, table tennis point by point, going offline mid-set (actions queued on the phone, then sent), an admin and an operator scoring the same match at once (both counted), a stale typed score refused with a clear message, finalize, and the public results page. No browser errors.
- **Tests**: 94 unit and 42 integration tests pass, plus lint, type checks and the production build.

## Operator phone behaviour

- Every action gets an id and enters an outbox in `localStorage`, so it survives reloads and crashes. The queue is sent in order, one action at a time.
- Network errors and server errors retry with backoff using the same id; coming back online retries immediately. A refused action pauses the queue and is shown for the operator to dismiss.
- Only one browser tab per operator and match sends (Web Locks); another tab can take over.
- The screen polls every 6 seconds with a cheap version check until Phase 5 adds realtime.
- The log shows server time, which decides order, and the time the button was pressed on the device.

## Screens

- `/operator` — live matches first, search by code or player, "Open score entry".
- `/operator/matches/[id]` and `/admin/matches/[id]` — the score screen; admins also get reopen, postpone and resume, time and place, and cancel (manual games).
- `/admin/matches` — tournament-wide monitor with filters and pagination.
- `/admin/games/[id]` — scoring rules, draw and bracket, manual rounds and matches.
- `/results` — confirmed results, brackets and podiums, when results are published in event settings. Scores in progress stay internal.

## Database

Migration `0002_scoring_event_log` adds `matches.score_json` and, on `match_updates`, `client_event_id` (unique), `device_time`, `voids_update_id` (unique), a unique `(match_id, match_version)` index, and `clock_timestamp()` times. It is applied to the live project; no live matches exist yet.

## Carried into Phase 5

- Replace polling with Supabase Broadcast from the database, as designed.
- Cross-game awards and standings for manual formats need committee rules (PRD 11.3).
- A third-place match is not generated; add it if the committee wants one.
