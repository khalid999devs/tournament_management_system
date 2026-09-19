# Supabase Integration

## Connection modes

Use the Transaction Pooler for runtime. A separate Session Pooler remains useful for local administrative work:

- `DATABASE_URL` - Transaction Pooler URL on port 6543 for the serverless application runtime.
- `MIGRATION_DATABASE_URL` - optional Session Pooler URL on port 5432 for long-running migrations and administrative tools.

Both URLs must use the exact pooler host and `postgres.<project-ref>` username copied from the Supabase Connect dialog. Add `sslmode=require` and percent-encode reserved characters in the password.

The direct database URL is structurally valid but IPv6-only. It cannot resolve from the current IPv4-only development environment and is not suitable for Vercel without Supabase's IPv4 add-on.

## Client safety

- Postgres.js uses one application-side connection per warm serverless instance.
- Prepared statements are disabled for Transaction Pooler compatibility.
- SSL is required.
- Browser code receives only the project URL and publishable key.
- Secret/service-role keys are never exposed to the client.
- Supabase Auth identity and application role authorization remain separate.

## Migration workflow

1. Review the generated SQL under `src/db/migrations`.
2. Run `pnpm db:migrate`. It prefers `MIGRATION_DATABASE_URL` and falls back to `DATABASE_URL`.
3. Verify all expected tables, constraints, foreign keys, indexes, and RLS state.
4. Run Supabase security and performance advisors.
5. Bootstrap the initial Super Admin only after its Auth user exists.

## Live verification

The initial migration and the additive staff-email migration were applied on 19 September 2026. The project has 16 public tables, 28 foreign keys, 67 indexes, and RLS enabled on every public table. No browser-role RLS policies have been added, so anonymous and authenticated Data API access is default-deny until a narrowly scoped policy is intentionally introduced.

Phase 3 operator invitations require the server-only `SUPABASE_SECRET_KEY` for Auth Admin link generation. It must never use a `NEXT_PUBLIC_` prefix or appear in the browser bundle. Match access is filtered through active assignment scopes in server-side SQL before pagination; operator queries do not select payment data.

## Initial Super Admin

1. Create or invite the email in `SUPER_ADMIN_EMAIL` from Supabase Authentication.
2. Complete its email/password setup.
3. Run `pnpm db:bootstrap-admin`.

The bootstrap command is idempotent. It only creates or reactivates the application profile after the corresponding Supabase Auth user exists; it never writes directly to `auth.users`.
