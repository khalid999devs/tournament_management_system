# Authorization Model

## Roles

| Role               | Identity      | Data boundary                                                                     |
| ------------------ | ------------- | --------------------------------------------------------------------------------- |
| Public participant | No account    | Public event content and immediate result of their own submission.                |
| Score Operator     | Supabase Auth | Minimum operational data within effective active assignments. Never payment data. |
| Super Admin        | Supabase Auth | Full application access with audit on sensitive actions.                          |

## Operator assignment scopes

Assignments are additive. Effective access is the union of all active scopes that belong to the same tournament and grant the required capability.

| Scope               | Access rule                                                     |
| ------------------- | --------------------------------------------------------------- |
| `ALL_TOURNAMENT`    | Any game, round, match, or participant entry in the tournament. |
| `GAME`              | Any current or future match under the selected tournament game. |
| `ROUND`             | Matches in the selected round.                                  |
| `MATCH`             | The selected match only.                                        |
| `PARTICIPANT_ENTRY` | Matches containing the selected registration game entry.        |

## Capabilities

- `VIEW` - view permitted operational information.
- `SCORE_UPDATE` - write in-progress score data.
- `FINALIZE_MATCH` - submit a valid final result.
- `ISSUE_REPORT` - flag an operational problem.

## Resolution rule

```text
canOperatorAccessMatch(operatorId, matchId, capability) =
  active staff profile
  AND active assignment with capability
  AND assignment tournament equals match tournament
  AND (
    whole tournament
    OR assignment game equals match game
    OR assignment round equals match round
    OR assignment match equals match
    OR assigned participant entry is present in match entries
  )
```

## Enforcement

- Navigation visibility is convenience, not authorization.
- Every staff page resolves the authenticated profile on the server.
- Every query applies role/scope filtering before pagination.
- Every mutation resolves authorization again immediately before state change.
- Assignment revocation takes effect on the next query or mutation even if a page is already open.
- Super Admin bypasses operator scope resolution but does not bypass validation, concurrency, or audit.
