import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDatabase } from "@/db";

type Limit = { limit: number; windowSeconds: number };

// Generous on purpose: a campus or mobile network can put many students
// behind one address, and they must never block each other.
export const rateLimits = {
  registration: { limit: 30, windowSeconds: 600 },
  staffLoginAccount: { limit: 10, windowSeconds: 900 },
  staffLoginAddress: { limit: 100, windowSeconds: 900 },
} satisfies Record<string, Limit>;

// Vercel sets these headers itself, so a client cannot choose its address.
export async function clientAddress() {
  const list = await headers();
  return (
    list.get("x-real-ip") ??
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function hashSubject(subject: string) {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? "ndcak")
    .update(subject)
    .digest("base64url")
    .slice(0, 32);
}

// Counts one attempt and says whether it is within the limit. If the counter
// cannot be reached the attempt goes ahead: the limit guards against floods,
// and the request itself will fail anyway if the database is down.
export async function allowAttempt(
  scope: string,
  subject: string,
  { limit, windowSeconds }: Limit,
) {
  try {
    const rows = await getDatabase().execute<{ hits: number }>(sql`
      insert into rate_limit_hits (key, window_start, hits)
      values (
        ${`${scope}:${hashSubject(subject)}`},
        to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}::int) * ${windowSeconds}::int),
        1
      )
      on conflict (key, window_start)
      do update set hits = rate_limit_hits.hits + 1
      returning hits
    `);
    return Number(rows[0]?.hits ?? 0) <= limit;
  } catch (error) {
    console.error(
      "Rate limit check failed",
      error instanceof Error ? error.message : error,
    );
    return true;
  }
}

export async function pruneRateLimits() {
  await getDatabase().execute(
    sql`delete from rate_limit_hits where window_start < now() - interval '1 day'`,
  );
}
