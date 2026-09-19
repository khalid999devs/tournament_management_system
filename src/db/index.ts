import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env/server";
import * as schema from "./schema";

const idleTimeoutSeconds = 20;

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

// max_pipeline is supported by postgres.js but missing from its types.
type ClientOptions = postgres.Options<Record<string, postgres.PostgresType>> & {
  max_pipeline?: number;
};

export function createDatabase(databaseUrl = getServerEnv().DATABASE_URL) {
  const options: ClientOptions = {
    max: 3,
    prepare: false,
    // One query at a time per connection. Pipelined queries through
    // Supabase's transaction pooler can stall until the connection dies,
    // which the production rehearsal hit whenever queries queued up.
    max_pipeline: 0,
    // Hosted databases always use TLS; local test databases usually have none.
    ssl: localHosts.has(new URL(databaseUrl).hostname) ? false : "require",
    idle_timeout: idleTimeoutSeconds,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  };
  const client = postgres(databaseUrl, options);

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;

type DatabaseHandle = { database: Database; lastUsedAt: number };

// Survives dev hot reloads so each edit does not leak a pooler connection.
const globalForDatabase = globalThis as typeof globalThis & {
  ndcakDatabase?: DatabaseHandle;
};

export function getDatabase() {
  const now = Date.now();
  const handle = globalForDatabase.ndcakDatabase;

  // Idle timers do not advance while a machine or VM is suspended, so a
  // socket can outlive its idle timeout and silently hang every later query.
  // The wall clock does advance, so a long gap means the socket is suspect.
  if (handle && now - handle.lastUsedAt > idleTimeoutSeconds * 1000) {
    // A short grace lets any query still running for another request on the
    // same instance finish; dead sockets are closed when it runs out.
    void handle.database.$client.end({ timeout: 5 }).catch(() => {});
    globalForDatabase.ndcakDatabase = undefined;
  }

  const current = (globalForDatabase.ndcakDatabase ??= {
    database: createDatabase(),
    lastUsedAt: now,
  });
  current.lastUsedAt = now;

  return current.database;
}
