import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { staffProfiles } from "@/db/schema";
import { eventDetailsSchema } from "@/features/event/domain/event-settings";
import {
  addTournamentGame,
  changeTournamentStatus,
  createTournament,
  savePaymentMethod,
  updateEventDetails,
  updateTournamentGame,
} from "@/features/event/server/manage-event";
import type { RegistrationSubmission } from "@/features/registration/domain/schemas";

export async function resetDatabase() {
  await getDatabase().execute(sql`
    truncate table
      audit_logs, notifications, issue_reports, match_updates, match_entries, operator_assignments,
      matches, rounds, payments, registration_game_entries, registrations,
      participants, payment_methods, tournament_games, games, tournaments,
      staff_profiles, rate_limit_hits
    restart identity cascade
  `);
}

export async function createStaff(role: "SUPER_ADMIN" | "SCORE_OPERATOR") {
  const [profile] = await getDatabase()
    .insert(staffProfiles)
    .values({
      authUserId: randomUUID(),
      email: `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`,
      displayName: role === "SUPER_ADMIN" ? "Test Admin" : "Test Operator",
      role,
    })
    .returning({ id: staffProfiles.id });

  return profile.id;
}

const inFuture = (days: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  // datetime-local format in Dhaka time.
  return new Date(date.getTime() + 6 * 3_600_000).toISOString().slice(0, 16);
};

export async function seedOpenEvent(
  adminId: string,
  gameCapacities: Record<string, number> = { Chess: 8 },
) {
  const tournamentId = await createTournament({
    actorId: adminId,
    name: "Integration Cup",
    year: 2026,
  });

  await updateEventDetails({
    actorId: adminId,
    tournamentId,
    details: eventDetailsSchema.parse({
      name: "Integration Cup",
      year: "2026",
      venue: "KUET Campus",
      description: "",
      checkInInstructions: "Bring your student ID.",
      startsAt: inFuture(30),
      endsAt: inFuture(31),
      registrationOpenAt: "",
      registrationCloseAt: inFuture(20),
      maxGamesPerParticipant: "3",
      departments: "Civil Engineering\nMechanical Engineering",
      academicYears: "1st year\n2nd year",
      resultsEnabled: false,
    }),
  });

  await savePaymentMethod({
    actorId: adminId,
    tournamentId,
    paymentMethodId: null,
    method: {
      displayName: "bKash",
      receivingAccount: "01700000000",
      instructions: null,
      enabled: true,
      sortOrder: 0,
    },
  });

  const gameIds: Record<string, string> = {};
  for (const [name, capacity] of Object.entries(gameCapacities)) {
    const id = await addTournamentGame({
      actorId: adminId,
      tournamentId,
      name,
      scoringAdapter: "CHESS_OUTCOME",
      feeTaka: 50,
      capacity,
    });
    await updateTournamentGame({
      actorId: adminId,
      tournamentGameId: id,
      config: {
        description: null,
        feeTaka: 50,
        capacity,
        availability: "OPEN",
        rules: null,
        sortOrder: 0,
      },
    });
    gameIds[name] = id;
  }

  await changeTournamentStatus({
    actorId: adminId,
    tournamentId,
    status: "REGISTRATION_OPEN",
  });

  return { tournamentId, gameIds };
}

let studentCounter = 0;

export function registrationInput(
  tournamentId: string,
  gameIds: string[],
  overrides: Partial<{
    studentId: string;
    transactionId: string;
    department: string;
  }> = {},
): RegistrationSubmission {
  studentCounter += 1;

  return {
    tournamentId,
    idempotencyKey: randomUUID(),
    details: {
      fullName: `Student ${studentCounter}`,
      studentId:
        overrides.studentId ??
        `19010${String(studentCounter).padStart(2, "0")}`,
      email: `student${studentCounter}@example.test`,
      phone: "01712345678",
      department: overrides.department ?? "Civil Engineering",
      academicYear: "1st year",
      selectedGameIds: gameIds,
    },
    paymentProvider: "BKASH",
    transactionId:
      overrides.transactionId ??
      `TXN${randomUUID().slice(0, 10).toUpperCase()}`,
  };
}
