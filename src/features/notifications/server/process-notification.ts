import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  games,
  notifications,
  participants,
  registrationGameEntries,
  registrations,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import { buildRegistrationEmail } from "@/features/notifications/domain/registration-email";
import { processOperatorInvite } from "@/features/operators/server/process-invite";
import { sendEmail } from "@/lib/email/send";
import { getEmailEnv } from "@/lib/env/server";

const supportedTypes = [
  "REGISTRATION_SUBMITTED",
  "REGISTRATION_APPROVED",
  "REGISTRATION_REJECTED",
] as const;

export async function processNotification(notificationId: string) {
  const db = getDatabase();
  const [kind] = await db
    .select({ type: notifications.type })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (kind?.type === "OPERATOR_INVITE") {
    return processOperatorInvite(notificationId);
  }

  const [claimed] = await db
    .update(notifications)
    .set({
      status: "SENDING",
      retryCount: sql`${notifications.retryCount} + 1`,
      errorText: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        inArray(notifications.status, ["QUEUED", "FAILED"]),
      ),
    )
    .returning({ id: notifications.id });

  if (!claimed) return { status: "SKIPPED" as const };

  try {
    const [context] = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        idempotencyKey: notifications.idempotencyKey,
        recipientEmail: notifications.recipientEmail,
        registrationId: registrations.id,
        registrationCode: registrations.code,
        rejectionReason: registrations.rejectionReason,
        participantName: participants.fullName,
        tournamentName: tournaments.name,
        tournamentSlug: tournaments.slug,
        timezone: tournaments.timezone,
        venue: tournaments.venue,
        startsAt: tournaments.startsAt,
        endsAt: tournaments.endsAt,
        publicSettings: tournaments.publicSettings,
      })
      .from(notifications)
      .innerJoin(
        registrations,
        eq(notifications.registrationId, registrations.id),
      )
      .innerJoin(participants, eq(registrations.participantId, participants.id))
      .innerJoin(tournaments, eq(registrations.tournamentId, tournaments.id))
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!context || !isSupportedType(context.type)) {
      throw new Error("Notification type is not supported by this processor.");
    }

    const selectedGames = await db
      .select({ name: games.name })
      .from(registrationGameEntries)
      .innerJoin(
        tournamentGames,
        eq(registrationGameEntries.tournamentGameId, tournamentGames.id),
      )
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .where(eq(registrationGameEntries.registrationId, context.registrationId))
      .orderBy(tournamentGames.sortOrder, games.name);

    const email = await buildRegistrationEmail({
      type: context.type,
      registrationId: context.registrationId,
      registrationCode: context.registrationCode,
      participantName: context.participantName,
      recipientEmail: context.recipientEmail,
      tournamentName: context.tournamentName,
      tournamentSlug: context.tournamentSlug,
      timezone: context.timezone,
      venue: context.venue,
      startsAt: context.startsAt,
      endsAt: context.endsAt,
      checkInInstructions: context.publicSettings.checkInInstructions,
      rejectionReason: context.rejectionReason,
      gameNames: selectedGames.map((game) => game.name),
      organizerEmail: getEmailEnv().EMAIL_REPLY_TO,
    });
    const result = await sendEmail({
      to: context.recipientEmail,
      ...email,
      idempotencyKey: context.idempotencyKey,
    });

    await db
      .update(notifications)
      .set({
        status: "SENT",
        providerMessageId: result?.id ?? null,
        errorText: null,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));

    return { status: "SENT" as const };
  } catch (error) {
    await db
      .update(notifications)
      .set({
        status: "FAILED",
        errorText: getSafeErrorMessage(error),
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));

    return { status: "FAILED" as const };
  }
}

function isSupportedType(
  type: string,
): type is (typeof supportedTypes)[number] {
  return supportedTypes.includes(type as (typeof supportedTypes)[number]);
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1500);
  return "Email delivery failed for an unknown reason.";
}
