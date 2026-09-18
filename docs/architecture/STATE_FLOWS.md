# State Flows

## Registration lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING_REVIEW: atomic submission
    PENDING_REVIEW --> CONFIRMED: admin approves
    PENDING_REVIEW --> REJECTED: admin rejects with reason
    CONFIRMED --> CANCELLED: organizer cancellation
    REJECTED --> [*]
    CANCELLED --> [*]
```

Approval confirms payment and every selected game entry in one transaction. Rejection rejects related state and releases every pending reservation in one transaction.

## Payment lifecycle

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: participant submits reference
    SUBMITTED --> VERIFIED: registration approved
    SUBMITTED --> REJECTED: registration rejected
    VERIFIED --> REFUNDED: optional audited future action
```

## Match lifecycle

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED
    SCHEDULED --> IN_PROGRESS: authorized score update
    SCHEDULED --> POSTPONED
    SCHEDULED --> WALKOVER
    SCHEDULED --> CANCELLED
    POSTPONED --> SCHEDULED: rescheduled
    IN_PROGRESS --> POSTPONED
    IN_PROGRESS --> COMPLETED: valid final result
    IN_PROGRESS --> WALKOVER
    COMPLETED --> IN_PROGRESS: admin reopens with reason
    WALKOVER --> IN_PROGRESS: admin reopens with reason
```

## Notification lifecycle

```mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> SENDING
    SENDING --> SENT
    SENDING --> FAILED
    FAILED --> QUEUED: authorized retry
```

Notification outbox records are committed atomically with authoritative state. Delivery starts only after that transaction commits, and delivery failures never reverse registration or match state.
