import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  matchEntries,
  matches,
  operatorAssignments,
  registrationGameEntries,
  registrations,
  rounds,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import type { OperatorCapability } from "@/db/schema/assignments";
import { reviewRegistration } from "@/features/admin/server/review-registration";
import {
  grantOperatorAssignment,
  revokeOperatorAssignment,
  setOperatorGameAccess,
} from "@/features/operators/server/manage-operators";
import { operatorMatchAccessPredicate } from "@/features/operators/server/workload";
import { submitRegistration } from "@/features/registration/server/submit-registration";
import {
  createStaff,
  registrationInput,
  resetDatabase,
  seedOpenEvent,
} from "./helpers";

type Fixture = {
  adminId: string;
  tournamentId: string;
  gameIds: Record<string, string>;
  roundIds: Record<string, string>;
  matchIds: Record<string, string>;
  entryIds: Record<string, string>;
};

let fixture: Fixture;

async function confirmedEntry(
  adminId: string,
  tournamentId: string,
  gameId: string,
) {
  const { registrationCode } = await submitRegistration(
    registrationInput(tournamentId, [gameId]),
  );
  const db = getDatabase();
  const [registration] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.code, registrationCode));
  await reviewRegistration({
    registrationId: registration.id,
    decision: "APPROVE",
    actorStaffId: adminId,
  });
  const [entry] = await db
    .select({ id: registrationGameEntries.id })
    .from(registrationGameEntries)
    .where(eq(registrationGameEntries.registrationId, registration.id));
  return entry.id;
}

async function createMatch(roundId: string, code: string, entries: string[]) {
  const db = getDatabase();
  const [match] = await db
    .insert(matches)
    .values({ roundId, code })
    .returning({ id: matches.id });
  await db.insert(matchEntries).values(
    entries.map((registrationGameEntryId, index) => ({
      matchId: match.id,
      registrationGameEntryId,
      seat: index + 1,
    })),
  );
  return match.id;
}

async function visibleMatches(
  operatorId: string,
  capability: OperatorCapability = "VIEW",
) {
  const db = getDatabase();
  const rows = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(operatorMatchAccessPredicate(operatorId, capability, db));
  const names = Object.fromEntries(
    Object.entries(fixture.matchIds).map(([name, id]) => [id, name]),
  );
  return rows.map((row) => names[row.id]).sort();
}

async function grant(
  operatorId: string,
  scopeType:
    "ALL_TOURNAMENT" | "GAME" | "ROUND" | "MATCH" | "PARTICIPANT_ENTRY",
  targetId: string | null,
  capabilities: OperatorCapability[] = ["VIEW"],
) {
  const { id } = await grantOperatorAssignment({
    actorId: fixture.adminId,
    operatorId,
    tournamentId: fixture.tournamentId,
    scopeType,
    targetId,
    capabilities,
  });
  return id;
}

beforeAll(async () => {
  await resetDatabase();
  const adminId = await createStaff("SUPER_ADMIN");
  const { tournamentId, gameIds } = await seedOpenEvent(adminId, {
    Chess: 8,
    Carrom: 8,
  });

  const chessA = await confirmedEntry(adminId, tournamentId, gameIds.Chess);
  const chessB = await confirmedEntry(adminId, tournamentId, gameIds.Chess);
  const carromA = await confirmedEntry(adminId, tournamentId, gameIds.Carrom);
  const carromB = await confirmedEntry(adminId, tournamentId, gameIds.Carrom);

  const db = getDatabase();
  const [chessRound1, chessRound2, carromRound1] = await db
    .insert(rounds)
    .values([
      { tournamentGameId: gameIds.Chess, name: "Round 1", sequence: 1 },
      { tournamentGameId: gameIds.Chess, name: "Final", sequence: 2 },
      { tournamentGameId: gameIds.Carrom, name: "Round 1", sequence: 1 },
    ])
    .returning({ id: rounds.id });

  fixture = {
    adminId,
    tournamentId,
    gameIds,
    roundIds: {
      chessRound1: chessRound1.id,
      chessRound2: chessRound2.id,
      carromRound1: carromRound1.id,
    },
    entryIds: { chessA, chessB, carromA, carromB },
    matchIds: {},
  };
  fixture.matchIds = {
    chessOpening: await createMatch(chessRound1.id, "C-1", [chessA, chessB]),
    chessFinal: await createMatch(chessRound2.id, "C-F", [chessA]),
    carromOpening: await createMatch(carromRound1.id, "R-1", [
      carromA,
      carromB,
    ]),
  };
});

describe("operator assignment scopes", () => {
  it("shows nothing before any assignment", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    expect(await visibleMatches(operatorId)).toEqual([]);
  });

  it("whole tournament shows every match", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "ALL_TOURNAMENT", null);
    expect(await visibleMatches(operatorId)).toEqual([
      "carromOpening",
      "chessFinal",
      "chessOpening",
    ]);
  });

  it("game scope shows only that game's matches", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "GAME", fixture.gameIds.Chess);
    expect(await visibleMatches(operatorId)).toEqual([
      "chessFinal",
      "chessOpening",
    ]);
  });

  it("round scope shows only that round", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "ROUND", fixture.roundIds.chessRound1);
    expect(await visibleMatches(operatorId)).toEqual(["chessOpening"]);
  });

  it("match scope shows only that match", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "MATCH", fixture.matchIds.carromOpening);
    expect(await visibleMatches(operatorId)).toEqual(["carromOpening"]);
  });

  it("participant scope shows matches that include the participant", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "PARTICIPANT_ENTRY", fixture.entryIds.chessA);
    expect(await visibleMatches(operatorId)).toEqual([
      "chessFinal",
      "chessOpening",
    ]);
  });

  it("combines several assignments", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "ROUND", fixture.roundIds.chessRound2);
    await grant(operatorId, "MATCH", fixture.matchIds.carromOpening);
    expect(await visibleMatches(operatorId)).toEqual([
      "carromOpening",
      "chessFinal",
    ]);
  });

  it("does not grant capabilities that were not given", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "GAME", fixture.gameIds.Carrom, ["VIEW"]);
    expect(await visibleMatches(operatorId, "SCORE_UPDATE")).toEqual([]);

    await grant(operatorId, "MATCH", fixture.matchIds.carromOpening, [
      "VIEW",
      "SCORE_UPDATE",
    ]);
    expect(await visibleMatches(operatorId, "SCORE_UPDATE")).toEqual([
      "carromOpening",
    ]);
  });

  it("removes access as soon as an assignment is revoked", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    const assignmentId = await grant(operatorId, "GAME", fixture.gameIds.Chess);
    expect(await visibleMatches(operatorId)).toHaveLength(2);

    await revokeOperatorAssignment({
      actorId: fixture.adminId,
      assignmentId,
      operatorId,
    });
    expect(await visibleMatches(operatorId)).toEqual([]);
  });

  it("replaces an assignment when the same target is granted again", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    const first = await grant(operatorId, "GAME", fixture.gameIds.Chess, [
      "VIEW",
    ]);
    const second = await grant(operatorId, "GAME", fixture.gameIds.Chess, [
      "VIEW",
      "SCORE_UPDATE",
    ]);

    expect(second).toBe(first);
    const rows = await getDatabase()
      .select({
        id: operatorAssignments.id,
        capabilities: operatorAssignments.capabilities,
        active: operatorAssignments.active,
      })
      .from(operatorAssignments)
      .where(eq(operatorAssignments.operatorId, operatorId));

    expect(rows).toHaveLength(1);
    expect(rows[0].capabilities).toEqual(["VIEW", "SCORE_UPDATE"]);
    expect(rows[0].active).toBe(true);
  });

  it("brings a removed assignment back instead of leaving a dead row", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    const assignmentId = await grant(operatorId, "GAME", fixture.gameIds.Chess);
    await revokeOperatorAssignment({
      actorId: fixture.adminId,
      assignmentId,
      operatorId,
    });
    expect(await visibleMatches(operatorId)).toEqual([]);

    const again = await grant(operatorId, "GAME", fixture.gameIds.Chess);
    expect(again).toBe(assignmentId);
    expect(await visibleMatches(operatorId)).toHaveLength(2);

    const rows = await getDatabase()
      .select({
        active: operatorAssignments.active,
        revokedAt: operatorAssignments.revokedAt,
        revokedBy: operatorAssignments.revokedBy,
      })
      .from(operatorAssignments)
      .where(eq(operatorAssignments.operatorId, operatorId));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      active: true,
      revokedAt: null,
      revokedBy: null,
    });
  });

  it("hands over a whole game, and takes it back, in one step", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await setOperatorGameAccess({
      actorId: fixture.adminId,
      operatorId,
      tournamentId: fixture.tournamentId,
      tournamentGameId: fixture.gameIds.Chess,
      enabled: true,
    });

    expect(await visibleMatches(operatorId)).toHaveLength(2);
    const [granted] = await getDatabase()
      .select({ capabilities: operatorAssignments.capabilities })
      .from(operatorAssignments)
      .where(eq(operatorAssignments.operatorId, operatorId));
    expect(granted.capabilities).toEqual([
      "VIEW",
      "SCORE_UPDATE",
      "FINALIZE_MATCH",
      "ISSUE_REPORT",
    ]);

    await setOperatorGameAccess({
      actorId: fixture.adminId,
      operatorId,
      tournamentId: fixture.tournamentId,
      tournamentGameId: fixture.gameIds.Chess,
      enabled: false,
    });
    expect(await visibleMatches(operatorId)).toEqual([]);

    // Turning it off twice is harmless.
    await setOperatorGameAccess({
      actorId: fixture.adminId,
      operatorId,
      tournamentId: fixture.tournamentId,
      tournamentGameId: fixture.gameIds.Chess,
      enabled: false,
    });
    expect(await visibleMatches(operatorId)).toEqual([]);
  });

  it("keeps assignments to different targets apart", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    await grant(operatorId, "GAME", fixture.gameIds.Chess);
    await grant(operatorId, "GAME", fixture.gameIds.Carrom);
    await grant(operatorId, "ALL_TOURNAMENT", null);

    const rows = await getDatabase()
      .select({ id: operatorAssignments.id })
      .from(operatorAssignments)
      .where(eq(operatorAssignments.operatorId, operatorId));

    expect(rows).toHaveLength(3);
  });

  it("rejects a target from another tournament", async () => {
    const operatorId = await createStaff("SCORE_OPERATOR");
    const db = getDatabase();
    const [other] = await db
      .insert(tournaments)
      .values({ name: "Other Cup", slug: "other-cup", year: 2025 })
      .returning({ id: tournaments.id });

    await expect(
      grantOperatorAssignment({
        actorId: fixture.adminId,
        operatorId,
        tournamentId: other.id,
        scopeType: "GAME",
        targetId: fixture.gameIds.Chess,
        capabilities: ["VIEW"],
      }),
    ).rejects.toMatchObject({ code: "scope_target_invalid" });

    const [stillThere] = await db
      .select({ id: tournamentGames.id })
      .from(tournamentGames)
      .where(
        and(
          eq(tournamentGames.id, fixture.gameIds.Chess),
          eq(tournamentGames.tournamentId, fixture.tournamentId),
        ),
      );
    expect(stillThere).toBeDefined();
  });

  it("refuses assignments for inactive or non-operator staff", async () => {
    await expect(
      grant(fixture.adminId, "ALL_TOURNAMENT", null),
    ).rejects.toMatchObject({ code: "operator_not_active" });
  });
});
