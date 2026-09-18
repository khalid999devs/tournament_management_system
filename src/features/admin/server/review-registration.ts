import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditLogs,
  notifications,
  participants,
  payments,
  registrationGameEntries,
  registrations,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import {
  planRegistrationReview,
  type ReviewDecision,
} from "@/features/registration/domain/review";

export class RegistrationReviewError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "ALREADY_REVIEWED"
      | "REASON_REQUIRED"
      | "CONFIGURATION_INCOMPLETE"
      | "CAPACITY_INCONSISTENT",
    message: string,
  ) {
    super(message);
    this.name = "RegistrationReviewError";
  }
}

type ReviewRegistrationInput = {
  registrationId: string;
  decision: ReviewDecision;
  reason?: string;
  actorStaffId: string;
};

export async function reviewRegistration(input: ReviewRegistrationInput) {
  const reason = input.reason?.trim();

  if (input.decision === "REJECT" && (!reason || reason.length < 3)) {
    throw new RegistrationReviewError(
      "REASON_REQUIRED",
      "Enter a participant-safe rejection reason.",
    );
  }

  const db = getDatabase();

  return db.transaction(async (tx) => {
    const [registration] = await tx
      .select({
        id: registrations.id,
        code: registrations.code,
        status: registrations.status,
        participantId: registrations.participantId,
        tournamentId: registrations.tournamentId,
        participantEmail: participants.email,
        startsAt: tournaments.startsAt,
        endsAt: tournaments.endsAt,
      })
      .from(registrations)
      .innerJoin(participants, eq(registrations.participantId, participants.id))
      .innerJoin(tournaments, eq(registrations.tournamentId, tournaments.id))
      .where(eq(registrations.id, input.registrationId))
      .limit(1)
      .for("update");

    if (!registration) {
      throw new RegistrationReviewError(
        "NOT_FOUND",
        "Registration was not found.",
      );
    }

    let plan;

    try {
      plan = planRegistrationReview(registration.status, input.decision);
    } catch {
      throw new RegistrationReviewError(
        "ALREADY_REVIEWED",
        "This registration has already been reviewed.",
      );
    }

    const notificationType =
      input.decision === "APPROVE"
        ? "REGISTRATION_APPROVED"
        : "REGISTRATION_REJECTED";

    if (!plan) {
      const [existingNotification] = await tx
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.registrationId, registration.id),
            eq(notifications.type, notificationType),
          ),
        )
        .limit(1);

      return {
        notificationId: existingNotification?.id ?? null,
        idempotent: true,
      };
    }

    if (
      input.decision === "APPROVE" &&
      (!registration.startsAt || !registration.endsAt)
    ) {
      throw new RegistrationReviewError(
        "CONFIGURATION_INCOMPLETE",
        "Set the tournament start and end time before approving registrations.",
      );
    }

    const entries = await tx
      .select({
        id: registrationGameEntries.id,
        tournamentGameId: registrationGameEntries.tournamentGameId,
      })
      .from(registrationGameEntries)
      .where(eq(registrationGameEntries.registrationId, registration.id))
      .orderBy(registrationGameEntries.tournamentGameId)
      .for("update");

    const gameIds = entries.map((entry) => entry.tournamentGameId);

    if (gameIds.length === 0) {
      throw new RegistrationReviewError(
        "CAPACITY_INCONSISTENT",
        "This registration has no game reservations.",
      );
    }

    await tx
      .select({ id: tournamentGames.id })
      .from(tournamentGames)
      .where(inArray(tournamentGames.id, gameIds))
      .orderBy(tournamentGames.id)
      .for("update");

    const reviewedAt = new Date();
    await tx
      .update(registrations)
      .set({
        status: plan.registrationStatus,
        reviewedBy: input.actorStaffId,
        reviewedAt,
        rejectionReason: input.decision === "REJECT" ? reason : null,
        updatedAt: reviewedAt,
      })
      .where(
        and(
          eq(registrations.id, registration.id),
          eq(registrations.status, "PENDING_REVIEW"),
        ),
      );

    await tx
      .update(registrationGameEntries)
      .set({ status: plan.entryStatus, updatedAt: reviewedAt })
      .where(eq(registrationGameEntries.registrationId, registration.id));

    await tx
      .update(payments)
      .set({
        status: plan.paymentStatus,
        verifiedBy: input.decision === "APPROVE" ? input.actorStaffId : null,
        verifiedAt: input.decision === "APPROVE" ? reviewedAt : null,
        updatedAt: reviewedAt,
      })
      .where(eq(payments.registrationId, registration.id));

    for (const tournamentGameId of gameIds) {
      const [updated] = await tx
        .update(tournamentGames)
        .set({
          reservedCount: sql`${tournamentGames.reservedCount} - 1`,
          confirmedCount:
            input.decision === "APPROVE"
              ? sql`${tournamentGames.confirmedCount} + 1`
              : tournamentGames.confirmedCount,
          updatedAt: reviewedAt,
        })
        .where(
          and(
            eq(tournamentGames.id, tournamentGameId),
            sql`${tournamentGames.reservedCount} > 0`,
          ),
        )
        .returning({ id: tournamentGames.id });

      if (!updated) {
        throw new RegistrationReviewError(
          "CAPACITY_INCONSISTENT",
          "Reserved capacity is inconsistent. No review changes were saved.",
        );
      }
    }

    const [notification] = await tx
      .insert(notifications)
      .values({
        registrationId: registration.id,
        recipientEmail: registration.participantEmail,
        type: notificationType,
        idempotencyKey: `registration:${registration.id}:${notificationType.toLowerCase()}`,
      })
      .onConflictDoNothing({ target: notifications.idempotencyKey })
      .returning({ id: notifications.id });

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorStaffId,
      action:
        input.decision === "APPROVE"
          ? "REGISTRATION_APPROVED"
          : "REGISTRATION_REJECTED",
      entityType: "registration",
      entityId: registration.id,
      before: { status: registration.status },
      after: {
        status: plan.registrationStatus,
        paymentStatus: plan.paymentStatus,
        gameEntryStatus: plan.entryStatus,
      },
      reason: input.decision === "REJECT" ? reason : null,
    });

    return { notificationId: notification?.id ?? null, idempotent: false };
  });
}
