import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env/server";
import * as schema from "./schema";

const idleTimeoutSeconds = 20;

export function createDatabase(databaseUrl = getServerEnv().DATABASE_URL) {
  const client = postgres(databaseUrl, {
    max: 3,
    prepare: false,
    ssl: "require",
    idle_timeout: idleTimeoutSeconds,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  });

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
    void handle.database.$client.end({ timeout: 0 }).catch(() => {});
    globalForDatabase.ndcakDatabase = undefined;
  }

  const current = (globalForDatabase.ndcakDatabase ??= {
    database: createDatabase(),
    lastUsedAt: now,
  });
  current.lastUsedAt = now;

  return current.database;
}
