import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import { allowAttempt, pruneRateLimits } from "@/lib/rate-limit";
import { resetDatabase } from "./helpers";

describe("attempt limits", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("allows exactly the limit under concurrent attempts, per address", async () => {
    const limit = { limit: 5, windowSeconds: 600 };
    const results = await Promise.all(
      Array.from({ length: 12 }, () => allowAttempt("test", "10.0.0.1", limit)),
    );

    expect(results.filter(Boolean)).toHaveLength(5);
    // Another address has its own allowance.
    expect(await allowAttempt("test", "10.0.0.2", limit)).toBe(true);

    const rows = await getDatabase().execute<{ key: string; hits: number }>(
      sql`select key, hits from rate_limit_hits order by hits desc`,
    );
    expect(rows.map((row) => row.hits)).toEqual([12, 1]);
    // Only a keyed hash is stored, never the address.
    expect(rows.every((row) => !row.key.includes("10.0.0"))).toBe(true);
  });

  it("keeps scopes apart", async () => {
    const limit = { limit: 1, windowSeconds: 600 };
    expect(await allowAttempt("register", "10.0.0.9", limit)).toBe(true);
    expect(await allowAttempt("login-address", "10.0.0.9", limit)).toBe(true);
    expect(await allowAttempt("register", "10.0.0.9", limit)).toBe(false);
  });

  it("prunes counters older than a day", async () => {
    await getDatabase().execute(sql`
      insert into rate_limit_hits (key, window_start, hits)
      values ('old', now() - interval '2 days', 3), ('recent', now(), 1)
    `);
    await pruneRateLimits();
    const rows = await getDatabase().execute<{ key: string }>(
      sql`select key from rate_limit_hits`,
    );
    expect(rows.map((row) => row.key)).toEqual(["recent"]);
  });
});
