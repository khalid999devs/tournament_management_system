import { timingSafeEqual } from "node:crypto";
import { runDailyJobs } from "@/features/notifications/server/daily-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(header: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

// Called once a day by the Vercel cron in vercel.json, which sends
// "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const summary = await runDailyJobs();
  console.info("Daily jobs finished", summary);
  return Response.json(
    { ok: true, ...summary },
    { headers: { "Cache-Control": "no-store" } },
  );
}
