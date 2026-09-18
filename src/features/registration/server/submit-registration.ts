import "server-only";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditLogs,
  games,
  notifications,
  participants,
  paymentMethods,
  payments,
  registrationGameEntries,
  registrations,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import { RegistrationDomainError } from "@/features/registration/domain/errors";
import {
  normalizeStudentId,
  normalizeTransactionId,
} from "@/features/registration/domain/normalization";
import { calculateRegistrationQuote } from "@/features/registration/domain/quote";
import {
  createRegistrationDetailsSchema,
  registrationSubmissionSchema,
  type RegistrationSubmission,
} from "@/features/registration/domain/schemas";
import type { RegistrationGameOption } from "@/features/registration/domain/types";

export type RegistrationSubmissionResult = {
  registrationCode: string;
  notificationId: string | null;
  reused: boolean;
};

export async function submitRegistration(
  input: RegistrationSubmission,
): Promise<RegistrationSubmissionResult> {
  const command = registrationSubmissionSchema.parse(input);
  const db = getDatabase();

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: registrations.id, code: registrations.code })
        .from(registrations)
        .where(eq(registrations.idempotencyKey, command.idempotencyKey))
        .limit(1);

      if (existing) {
        const [notification] = await tx
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.registrationId, existing.id),
              eq(notifications.type, "REGISTRATION_SUBMITTED"),
            ),
          )
          .limit(1);

        return {
          registrationCode: existing.code,
          notificationId: notification?.id ?? null,
          reused: true,
        };
      }

      const [tournament] = await tx
        .select({
          id: tournaments.id,
          year: tournaments.year,
          status: tournaments.status,
          registrationOpenAt: tournaments.registrationOpenAt,
          registrationCloseAt: tournaments.registrationCloseAt,
          maxGamesPerParticipant: tournaments.maxGamesPerParticipant,
        })
        .from(tournaments)
        .where(eq(tournaments.id, command.tournamentId))
        .limit(1)
        .for("update");

      const now = new Date();

      if (
        !tournament ||
        tournament.status !== "REGISTRATION_OPEN" ||
        (tournament.registrationOpenAt &&
          tournament.registrationOpenAt > now) ||
        (tournament.registrationCloseAt &&
          tournament.registrationCloseAt <= now)
      ) {
        throw new RegistrationDomainError(
          "REGISTRATION_CLOSED",
          "Registration is not open for this event.",
        );
      }

      const details = createRegistrationDetailsSchema(
        tournament.maxGamesPerParticipant,
      ).parse(command.details);
      const selectedIds = [...details.selectedGameIds].sort();

      const selectedGames = await tx
        .select({
          id: tournamentGames.id,
          name: games.name,
          description: games.description,
          feeMinor: tournamentGames.feeMinor,
          capacity: tournamentGames.capacity,
          reservedCount: tournamentGames.reservedCount,
          confirmedCount: tournamentGames.confirmedCount,
          registrationOpen: tournamentGames.registrationOpen,
          status: tournamentGames.status,
          tournamentId: tournamentGames.tournamentId,
        })
        .from(tournamentGames)
        .innerJoin(games, eq(tournamentGames.gameId, games.id))
        .where(inArray(tournamentGames.id, selectedIds))
        .orderBy(tournamentGames.id)
        .for("update");

      const quoteOptions: RegistrationGameOption[] = selectedGames.map(
        (game) => ({
          id: game.id,
          name: game.name,
          description: game.description ?? "Tournament game",
          feeMinor: game.feeMinor,
          capacity: game.capacity,
          reservedCount: game.reservedCount,
          confirmedCount: game.confirmedCount,
          registrationOpen:
            game.registrationOpen &&
            game.status === "REGISTRATION_OPEN" &&
            game.tournamentId === tournament.id,
        }),
      );
      const quote = calculateRegistrationQuote(
        quoteOptions,
        details.selectedGameIds,
        tournament.maxGamesPerParticipant,
      );

      const [paymentMethod] = await tx
        .select({
          provider: paymentMethods.provider,
          receivingAccount: paymentMethods.receivingAccount,
        })
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.tournamentId, tournament.id),
            eq(paymentMethods.provider, command.paymentProvider),
            eq(paymentMethods.enabled, true),
          ),
        )
        .limit(1)
        .for("update");

      if (!paymentMethod) {
        throw new RegistrationDomainError(
          "PAYMENT_METHOD_UNAVAILABLE",
          "The selected payment method is no longer available.",
        );
      }

      const normalizedStudentId = normalizeStudentId(details.studentId);
      const [participant] = await tx
        .insert(participants)
        .values({
          normalizedStudentId,
          fullName: details.fullName,
          email: details.email.toLowerCase(),
          phone: details.phone,
          department: details.department,
          academicYear: details.academicYear,
        })
        .onConflictDoUpdate({
          target: participants.normalizedStudentId,
          set: {
            fullName: details.fullName,
            email: details.email.toLowerCase(),
            phone: details.phone,
            department: details.department,
            academicYear: details.academicYear,
            updatedAt: now,
          },
        })
        .returning({ id: participants.id });

      if (!participant) {
        throw new RegistrationDomainError(
          "INVALID_SUBMISSION",
          "The participant record could not be created.",
        );
      }

      const registrationCode = createRegistrationCode(tournament.year);
      const [registration] = await tx
        .insert(registrations)
        .values({
          code: registrationCode,
          tournamentId: tournament.id,
          participantId: participant.id,
          totalFeeMinor: quote.totalFeeMinor,
          idempotencyKey: command.idempotencyKey,
        })
        .onConflictDoNothing({ target: registrations.idempotencyKey })
        .returning({ id: registrations.id, code: registrations.code });

      if (!registration) {
        const [duplicate] = await tx
          .select({ id: registrations.id, code: registrations.code })
          .from(registrations)
          .where(eq(registrations.idempotencyKey, command.idempotencyKey))
          .limit(1);

        if (!duplicate) {
          throw new RegistrationDomainError(
            "INVALID_SUBMISSION",
            "The registration could not be created.",
          );
        }

        return {
          registrationCode: duplicate.code,
          notificationId: null,
          reused: true,
        };
      }

      for (const tournamentGameId of selectedIds) {
        const [reserved] = await tx
          .update(tournamentGames)
          .set({
            reservedCount: sql`${tournamentGames.reservedCount} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(tournamentGames.id, tournamentGameId),
              eq(tournamentGames.tournamentId, tournament.id),
              eq(tournamentGames.registrationOpen, true),
              eq(tournamentGames.status, "REGISTRATION_OPEN"),
              sql`${tournamentGames.reservedCount} + ${tournamentGames.confirmedCount} < ${tournamentGames.capacity}`,
            ),
          )
          .returning({ id: tournamentGames.id });

        if (!reserved) {
          throw new RegistrationDomainError(
            "GAME_FULL",
            "A selected game filled up before submission. Review availability and try again.",
            tournamentGameId,
          );
        }
      }

      await tx.insert(registrationGameEntries).values(
        selectedIds.map((tournamentGameId) => ({
          registrationId: registration.id,
          tournamentGameId,
        })),
      );

      await tx.insert(payments).values({
        registrationId: registration.id,
        provider: paymentMethod.provider,
        receivingAccountSnapshot: paymentMethod.receivingAccount,
        expectedAmountMinor: quote.totalFeeMinor,
        transactionIdRaw: command.transactionId.trim(),
        transactionIdNormalized: normalizeTransactionId(command.transactionId),
      });

      const [notification] = await tx
        .insert(notifications)
        .values({
          registrationId: registration.id,
          recipientEmail: details.email.toLowerCase(),
          type: "REGISTRATION_SUBMITTED",
          idempotencyKey: `registration:${registration.id}:submitted`,
        })
        .returning({ id: notifications.id });

      await tx.insert(auditLogs).values({
        action: "REGISTRATION_SUBMITTED",
        entityType: "registration",
        entityId: registration.id,
        after: {
          status: "PENDING_REVIEW",
          selectedGameIds: selectedIds,
          totalFeeMinor: quote.totalFeeMinor,
          paymentProvider: paymentMethod.provider,
        },
      });

      return {
        registrationCode: registration.code,
        notificationId: notification?.id ?? null,
        reused: false,
      };
    });
  } catch (error) {
    throw mapRegistrationError(error);
  }
}

function createRegistrationCode(year: number) {
  return `ND${String(year).slice(-2)}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function mapRegistrationError(error: unknown) {
  if (error instanceof RegistrationDomainError) return error;

  const databaseError = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
  };
  const constraint =
    databaseError.constraint_name ?? databaseError.constraint ?? "";

  if (
    databaseError.code === "23505" &&
    constraint.includes("active_participant")
  ) {
    return new RegistrationDomainError(
      "DUPLICATE_REGISTRATION",
      "This student already has an active registration for the event.",
    );
  }

  if (
    databaseError.code === "23505" &&
    constraint.includes("provider_transaction")
  ) {
    return new RegistrationDomainError(
      "DUPLICATE_TRANSACTION",
      "This transaction ID has already been used for this payment provider.",
    );
  }

  return error;
}
