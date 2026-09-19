import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import { auditLogs, paymentMethods, tournamentGames } from "@/db/schema";
import { eventDetailsSchema } from "@/features/event/domain/event-settings";
import { getEventSetup } from "@/features/event/server/event-queries";
import {
  addTournamentGame,
  archiveTournamentGame,
  changeTournamentStatus,
  createTournament,
  savePaymentMethod,
  updateEventDetails,
  updateTournamentGame,
} from "@/features/event/server/manage-event";
import { submitRegistration } from "@/features/registration/server/submit-registration";
import {
  createStaff,
  registrationInput,
  resetDatabase,
  seedOpenEvent,
} from "./helpers";

const gameConfig = {
  description: null,
  feeTaka: 50,
  capacity: 8,
  scoringAdapter: "CHESS_OUTCOME" as const,
  progressionMode: "AUTOMATIC_SINGLE_ELIMINATION" as const,
  availability: "OPEN" as const,
  rules: null,
  sortOrder: 0,
};

describe("event settings", () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDatabase();
    adminId = await createStaff("SUPER_ADMIN");
  });

  it("refuses to open registration until the checklist is complete", async () => {
    const tournamentId = await createTournament({
      actorId: adminId,
      name: "Draft Cup",
      year: 2026,
    });

    await expect(
      changeTournamentStatus({
        actorId: adminId,
        tournamentId,
        status: "REGISTRATION_OPEN",
      }),
    ).rejects.toMatchObject({ code: "not_ready" });

    const setup = await getEventSetup();
    expect(setup?.tournament.status).toBe("DRAFT");
    expect(
      setup?.readiness
        .filter((check) => check.required && !check.ok)
        .map((check) => check.key),
    ).toEqual(["dates", "venue", "closing", "games"]);
  });

  it("opens registration once ready and records each step in the audit log", async () => {
    await seedOpenEvent(adminId);

    const setup = await getEventSetup();
    expect(setup?.tournament.status).toBe("REGISTRATION_OPEN");

    const actions = (
      await getDatabase().select({ action: auditLogs.action }).from(auditLogs)
    ).map((row) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "TOURNAMENT_CREATED",
        "TOURNAMENT_UPDATED",
        "PAYMENT_METHOD_CREATED",
        "TOURNAMENT_GAME_ADDED",
        "TOURNAMENT_GAME_UPDATED",
        "TOURNAMENT_STATUS_CHANGED",
      ]),
    );
  });

  it("only manages one tournament at a time", async () => {
    await createTournament({ actorId: adminId, name: "First", year: 2026 });

    await expect(
      createTournament({ actorId: adminId, name: "Second", year: 2026 }),
    ).rejects.toMatchObject({ code: "tournament_exists" });
  });

  it("keeps required details while registration is open", async () => {
    const { tournamentId } = await seedOpenEvent(adminId);

    await expect(
      updateEventDetails({
        actorId: adminId,
        tournamentId,
        details: eventDetailsSchema.parse({
          name: "Integration Cup",
          year: "2026",
          venue: "",
          description: "",
          checkInInstructions: "",
          startsAt: "",
          endsAt: "",
          registrationOpenAt: "",
          registrationCloseAt: "",
          maxGamesPerParticipant: "3",
          departments: "Civil Engineering",
          academicYears: "1st year",
          resultsEnabled: false,
        }),
      }),
    ).rejects.toMatchObject({ code: "required_while_open" });
  });

  it("does not let capacity drop below places already taken", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId, {
      Chess: 4,
    });
    await submitRegistration(registrationInput(tournamentId, [gameIds.Chess]));
    await submitRegistration(registrationInput(tournamentId, [gameIds.Chess]));

    await expect(
      updateTournamentGame({
        actorId: adminId,
        tournamentGameId: gameIds.Chess,
        config: { ...gameConfig, capacity: 1 },
      }),
    ).rejects.toMatchObject({ code: "capacity_below_taken" });

    await updateTournamentGame({
      actorId: adminId,
      tournamentGameId: gameIds.Chess,
      config: { ...gameConfig, capacity: 2 },
    });
    const [game] = await getDatabase()
      .select({ capacity: tournamentGames.capacity })
      .from(tournamentGames)
      .where(eq(tournamentGames.id, gameIds.Chess));
    expect(game.capacity).toBe(2);
  });

  it("keeps games with registrations and revives removed ones", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId, {
      Chess: 4,
    });
    await submitRegistration(registrationInput(tournamentId, [gameIds.Chess]));

    await expect(
      archiveTournamentGame({
        actorId: adminId,
        tournamentGameId: gameIds.Chess,
      }),
    ).rejects.toMatchObject({ code: "game_has_entries" });

    const carrom = await addTournamentGame({
      actorId: adminId,
      tournamentId,
      name: "Carrom",
      scoringAdapter: "CARROM_POINTS",
      feeTaka: 30,
      capacity: 10,
    });
    await archiveTournamentGame({ actorId: adminId, tournamentGameId: carrom });

    const revived = await addTournamentGame({
      actorId: adminId,
      tournamentId,
      name: "carrom",
      scoringAdapter: "CARROM_POINTS",
      feeTaka: 40,
      capacity: 12,
    });
    expect(revived).toBe(carrom);

    await expect(
      addTournamentGame({
        actorId: adminId,
        tournamentId,
        name: "Carrom",
        scoringAdapter: "CARROM_POINTS",
        feeTaka: 40,
        capacity: 12,
      }),
    ).rejects.toMatchObject({ code: "game_exists" });
  });

  it("derives a stable provider key and keeps it when a method is edited", async () => {
    const { tournamentId } = await seedOpenEvent(adminId);
    const db = getDatabase();
    const [method] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.tournamentId, tournamentId));

    expect(method.provider).toBe("BKASH");

    await savePaymentMethod({
      actorId: adminId,
      tournamentId,
      paymentMethodId: method.id,
      method: {
        displayName: "bKash Personal",
        receivingAccount: "01800000000",
        instructions: "Send Money only.",
        enabled: true,
        sortOrder: 0,
      },
    });

    const [updated] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, method.id));
    expect(updated.provider).toBe("BKASH");
    expect(updated.receivingAccount).toBe("01800000000");
  });
});
