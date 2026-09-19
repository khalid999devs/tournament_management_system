import "server-only";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditLogs,
  notifications,
  registrations,
  tournaments,
} from "@/db/schema";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { isReminderDue, reminderSendDay, zonedDay } from "../domain/reminders";
import { processNotification } from "./process-notification";

export type ReminderErrorCode =
  "NO_TOURNAMENT" | "NEEDS_DATES" | "EVENT_STARTED";

export class ReminderError extends Error {
  constructor(readonly code: ReminderErrorCode) {
    super(code);
    this.name = "ReminderError";
  }
}

export async function saveReminderSetting(input: {
  actorId: string;
  daysBefore: number | null;
}) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const tournamentId = await findCurrentTournamentId(tx);
    if (!tournamentId) throw new ReminderError("NO_TOURNAMENT");
    const [before] = await tx
      .select({ daysBefore: tournaments.reminderDaysBefore })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .for("update");
    await tx
      .update(tournaments)
      .set({ reminderDaysBefore: input.daysBefore, updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId));
    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "REMINDER_SETTING_CHANGED",
      entityType: "tournament",
      entityId: tournamentId,
      before: { reminderDaysBefore: before?.daysBefore ?? null },
      after: { reminderDaysBefore: input.daysBefore },
    });
  });
}

// Queues one reminder for every confirmed registration that does not have
// one for the current event date. The unique idempotency key makes this safe
// to run any number of times, even at once: nobody is emailed twice.
// Without force it only queues on or after the configured send day.
export async function queueEventReminders(input: {
  now: Date;
  force?: boolean;
  actorId?: string;
}) {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  if (!tournamentId) {
    if (input.force) throw new ReminderError("NO_TOURNAMENT");
    return { queued: 0, due: false };
  }

  const [event] = await db
    .select({
      startsAt: tournaments.startsAt,
      timezone: tournaments.timezone,
      daysBefore: tournaments.reminderDaysBefore,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!event?.startsAt) {
    if (input.force) throw new ReminderError("NEEDS_DATES");
    return { queued: 0, due: false };
  }
  if (input.now >= event.startsAt) {
    if (input.force) throw new ReminderError("EVENT_STARTED");
    return { queued: 0, due: false };
  }
  if (
    !input.force &&
    (!event.daysBefore ||
      !isReminderDue({
        now: input.now,
        startsAt: event.startsAt,
        daysBefore: event.daysBefore,
        timeZone: event.timezone,
      }))
  ) {
    return { queued: 0, due: false };
  }

  const day = zonedDay(event.startsAt, event.timezone);
  const rows = await db.execute<{ id: string }>(sql`
    insert into notifications (registration_id, recipient_email, type, idempotency_key)
    select r.id, p.email, 'EVENT_REMINDER', 'event-reminder:' || r.id || ':' || ${day}
    from registrations r
    join participants p on p.id = r.participant_id
    where r.tournament_id = ${tournamentId} and r.status = 'CONFIRMED'
    on conflict (idempotency_key) do nothing
    returning id
  `);
  const queued = rows.length;

  if (input.force && input.actorId) {
    await db.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "REMINDERS_SENT_NOW",
      entityType: "tournament",
      entityId: tournamentId,
      after: { queued, eventDay: day },
    });
  }

  return { queued, due: true };
}

const retryableTypes = [
  "REGISTRATION_SUBMITTED",
  "REGISTRATION_APPROVED",
  "REGISTRATION_REJECTED",
  "EVENT_REMINDER",
] as const;

const maxAutomaticAttempts = 3;

// Sends waiting emails, three at a time, until the deadline. Each message is
// claimed before sending, so overlapping runs never send one twice; anything
// left over stays queued for the next run.
export async function sendQueuedNotifications(options: {
  deadline: number;
  retryFailed?: boolean;
  types?: (typeof notifications.$inferSelect.type)[];
}) {
  const waiting: SQL[] = [eq(notifications.status, "QUEUED")];
  if (options.retryFailed) {
    waiting.push(
      and(
        eq(notifications.status, "FAILED"),
        lt(notifications.retryCount, maxAutomaticAttempts),
        inArray(notifications.type, [...retryableTypes]),
      )!,
    );
  }
  const conditions: SQL[] = [or(...waiting)!];
  if (options.types?.length) {
    conditions.push(inArray(notifications.type, options.types));
  }

  const rows = await getDatabase()
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(...conditions))
    .orderBy(asc(notifications.createdAt), asc(notifications.id))
    .limit(500);

  const queue = rows.map((row) => row.id);
  const result = { sent: 0, failed: 0, skipped: 0, remaining: 0 };
  const worker = async () => {
    while (queue.length && Date.now() < options.deadline) {
      const id = queue.shift()!;
      const outcome = await processNotification(id);
      if (outcome.status === "SENT") result.sent += 1;
      else if (outcome.status === "FAILED") result.failed += 1;
      else result.skipped += 1;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  result.remaining = queue.length;
  return result;
}

// A message stuck in SENDING (the server stopped mid-send) becomes FAILED
// so the next run or an admin can retry it.
export async function recoverStuckNotifications(now: Date) {
  const cutoff = new Date(now.getTime() - 15 * 60_000);
  const rows = await getDatabase()
    .update(notifications)
    .set({
      status: "FAILED",
      errorText: "Sending was interrupted before it finished.",
      updatedAt: now,
    })
    .where(
      and(
        eq(notifications.status, "SENDING"),
        lt(notifications.updatedAt, cutoff),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}

export async function getReminderSummary() {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  if (!tournamentId) return null;

  const [[event], [confirmed], statusRows] = await Promise.all([
    db
      .select({
        startsAt: tournaments.startsAt,
        timezone: tournaments.timezone,
        daysBefore: tournaments.reminderDaysBefore,
      })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1),
    db
      .select({ value: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.tournamentId, tournamentId),
          eq(registrations.status, "CONFIRMED"),
        ),
      ),
    db
      .select({ status: notifications.status, value: count() })
      .from(notifications)
      .innerJoin(
        registrations,
        eq(notifications.registrationId, registrations.id),
      )
      .where(
        and(
          eq(registrations.tournamentId, tournamentId),
          eq(notifications.type, "EVENT_REMINDER"),
        ),
      )
      .groupBy(notifications.status),
  ]);

  const byStatus = (status: string) =>
    Number(statusRows.find((row) => row.status === status)?.value ?? 0);

  return {
    daysBefore: event.daysBefore,
    startsAt: event.startsAt,
    timeZone: event.timezone,
    sendDay:
      event.startsAt && event.daysBefore
        ? reminderSendDay(event.startsAt, event.daysBefore, event.timezone)
        : null,
    confirmed: Number(confirmed?.value ?? 0),
    sent: byStatus("SENT"),
    waiting: byStatus("QUEUED") + byStatus("SENDING"),
    failed: byStatus("FAILED"),
  };
}
