import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { pruneRateLimits } from "@/lib/rate-limit";
import {
  queueEventReminders,
  recoverStuckNotifications,
  sendQueuedNotifications,
} from "./reminders";

// Leaves headroom under the platform's 300-second function limit.
const sendBudgetMs = 240_000;

// Runs once a day from the scheduled job. Each step is safe to repeat, so a
// missed or doubled run does no harm.
export async function runDailyJobs(now = new Date()) {
  const started = Date.now();
  // Any query counts as activity, which keeps a free Supabase project from
  // pausing between events.
  await getDatabase().execute(sql`select 1`);
  await pruneRateLimits();
  const recovered = await recoverStuckNotifications(now);
  const reminders = await queueEventReminders({ now });
  const delivery = await sendQueuedNotifications({
    deadline: started + sendBudgetMs,
    retryFailed: true,
  });
  return { recovered, reminders, delivery };
}
