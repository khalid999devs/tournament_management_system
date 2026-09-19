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

Phase 3 operator invitations use the locally configured and verified server-only `SUPABASE_SECRET_KEY` for Auth Admin link generation. It must never use a `NEXT_PUBLIC_` prefix or appear in the browser bundle. Match access is filtered through active assignment scopes in server-side SQL before pagination; operator queries do not select payment data.

## Initial Super Admin

The official Auth user and active app profile were created with `pnpm db:invite-admin`. That command uses the Admin API to generate a time-limited link and sends it to `SUPER_ADMIN_EMAIL` through Resend; it does not create or disclose a password. The setup link was accepted, and the Auth user is confirmed with a password set. Reopening a used link does not replace normal staff sign-in.

If the link expires, rerun `pnpm db:invite-admin` for a fresh link. `pnpm db:bootstrap-admin` remains available for an Auth user created independently in the Dashboard. Both commands upsert the app profile; Auth-user creation happens only through the Supabase Admin API, never direct writes to `auth.users`.

## Codex MCP

The project-scoped Supabase MCP server is registered in the local Codex configuration. OAuth approval has not completed: the login attempt reached the Supabase consent page but timed out awaiting its browser callback. When ready, run `codex mcp login supabase --scopes projects:read,database:read,database:write`, approve the browser prompt, and start a fresh Codex session to load the MCP tools. The app and Admin setup do not depend on MCP.
