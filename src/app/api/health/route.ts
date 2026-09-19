import { sql } from "drizzle-orm";
import { getDatabase } from "@/db";

export const dynamic = "force-dynamic";

// For uptime checks: 200 when the site can reach its database, 503 when not.
export async function GET() {
  const started = Date.now();
  const headers = { "Cache-Control": "no-store" };

  try {
    await getDatabase().execute(sql`select 1`);
    return Response.json(
      { ok: true, database: "reachable", ms: Date.now() - started },
      { headers },
    );
  } catch {
    return Response.json(
      { ok: false, database: "unreachable" },
      { status: 503, headers },
    );
  }
}
