# System Architecture

## Runtime context

```mermaid
flowchart LR
    Public[Participant browser] -->|Public reads and registration commands| Web[Next.js App Router on Vercel]
    Staff[Admin and Operator browser] -->|Cookie session and scoped commands| Web
    Web -->|Drizzle over server-only connection| DB[(Supabase PostgreSQL)]
    Web -->|Staff identity and session| Auth[Supabase Auth]
    DB -->|Committed change feed| Realtime[Supabase Realtime]
    Realtime -->|Authenticated updates| Staff
    Web -->|Post-commit email request| Email[Resend]
    Cron[Vercel Cron] -->|Idempotent reminders| Web
    Public -->|Registration challenge| Turnstile[Cloudflare Turnstile]
```

## Trust boundaries

- The browser never receives the database URL, Supabase secret/service key, Resend key, or Turnstile secret.
- Public and staff mutations enter through typed server actions or route handlers.
- Server-side Zod schemas validate external input before domain services run.
- Drizzle owns application schema, migrations, and transactional query logic.
- Supabase Auth establishes identity; application authorization resolves role and assignment scope.
- Realtime delivers notifications only. Reads after reconnect always come from authoritative queries.
- Email delivery begins after transaction commit and records independent delivery status.

## Application layers

```mermaid
flowchart TB
    Routes[App Router pages and layouts] --> Features[Feature UI and server commands]
    Features --> Domain[Domain policies and state transitions]
    Domain --> Permissions[Role and resource authorization]
    Domain --> Scoring[Scoring adapters]
    Domain --> Repositories[Typed repositories and transactions]
    Repositories --> Drizzle[Drizzle ORM]
    Drizzle --> Postgres[(PostgreSQL)]
    Features --> Notifications[Notification orchestration]
    Notifications --> Resend[Resend]
```

Pages compose feature modules. They do not implement capacity, authorization, progression, or payment state rules.

## Registration submission

```mermaid
sequenceDiagram
    participant P as Participant
    participant W as Next.js server
    participant D as PostgreSQL
    participant E as Email worker

    P->>W: submitRegistration(input, idempotencyKey)
    W->>W: validate input and anti-bot token
    W->>D: begin transaction
    W->>D: lock tournament-game capacity rows
    W->>D: validate window, duplicate policy, capacity, and fee
    W->>D: create participant, registration, game entries, reservation, payment, audit event
    W->>D: commit
    W-->>P: pending registration code
    W->>E: enqueue acknowledgment after commit
```

## Registration review

```mermaid
sequenceDiagram
    participant A as Super Admin
    participant W as Next.js server
    participant D as PostgreSQL
    participant E as Email worker

    A->>W: approve or reject registration
    W->>W: resolve authenticated Super Admin
    W->>D: begin transaction and lock registration
    W->>D: verify pending state
    alt Approve
        W->>D: verify payment, confirm registration and entries, finalize reservations
    else Reject
        W->>D: reject payment, registration, and entries; release reservations
    end
    W->>D: append audit event and commit
    W->>E: enqueue decision email after commit
    W-->>A: reviewed state
```

## Match finalization

```mermaid
sequenceDiagram
    participant O as Score Operator
    participant W as Next.js server
    participant D as PostgreSQL

    O->>W: finalizeMatch(matchId, payload, expectedVersion)
    W->>D: resolve current assignment access
    W->>W: validate adapter payload
    W->>D: begin transaction and lock match
    W->>D: require version == expectedVersion
    W->>D: write canonical result, entries, status, audit, and version + 1
    opt Automatic progression
        W->>D: place qualifiers into configured next slots
    end
    W->>D: commit
    W-->>O: finalized result
```

## Failure strategy

- Domain failures return explicit error codes instead of leaking stack traces.
- Retried commands use idempotency/state checks.
- Stale match writers receive a conflict and current-state reload guidance.
- Email and realtime failure never invalidate committed registration or match state.
- Destructive deletion is replaced by inactive/archived state when dependent records exist.
