# Integration tests

The integration suite runs the real registration, review, event-settings and operator-scope services against PostgreSQL. It covers the PRD's P0 integration cases: two students competing for the last place, approve/reject consistency, duplicate transaction IDs after normalization, and each operator assignment scope.

Every test truncates all tables. The setup refuses any database that is not on `localhost`, so it cannot run against Supabase.

## Run locally

Start a disposable PostgreSQL server (any version 15+), then create and migrate a database:

```bash
initdb -D /tmp/ndcak-pg -U postgres --auth=trust
pg_ctl -D /tmp/ndcak-pg -o "-p 55432 -c listen_addresses=127.0.0.1" start
createdb -h 127.0.0.1 -p 55432 -U postgres ndcak_integration
MIGRATION_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/ndcak_integration pnpm exec drizzle-kit migrate
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/ndcak_integration pnpm test:integration
```

Docker works too: `docker run --rm -p 55432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:18`.

`pnpm test` runs only the fast unit suite and never needs a database.
