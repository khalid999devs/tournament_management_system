import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditLogs,
  matchEntries,
  matches,
  matchUpdates,
  registrationGameEntries,
  registrations,
  rounds,
} from "@/db/schema";
import { reviewRegistration } from "@/features/admin/server/review-registration";
import {
  getScoringLock,
  updateScoringRules,
  updateTournamentGame,
} from "@/features/event/server/manage-event";
import type { ScoreCommand } from "@/features/matches/domain/commands";
import {
  addManualMatch,
  addRound,
  generateBracket,
  resetBracket,
} from "@/features/matches/server/manage-brackets";
import {
  executeScoreCommand,
  reopenMatch,
  type MatchActor,
} from "@/features/matches/server/match-commands";
import { getMatchState } from "@/features/matches/server/match-queries";
import {
  grantOperatorAssignment,
  revokeOperatorAssignment,
} from "@/features/operators/server/manage-operators";
import { submitRegistration } from "@/features/registration/server/submit-registration";
import type { ScoringAdapterKey } from "@/features/scoring/adapters";
import {
  createStaff,
  registrationInput,
  resetDatabase,
  seedOpenEvent,
} from "./helpers";

let admin: MatchActor;
let tournamentId: string;
let gameIds: Record<string, string>;

async function confirmPlayers(gameId: string, count: number) {
  const db = getDatabase();
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const { registrationCode } = await submitRegistration(
      registrationInput(tournamentId, [gameId]),
    );
    const [registration] = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.code, registrationCode));
    await reviewRegistration({
      registrationId: registration.id,
      decision: "APPROVE",
      actorStaffId: admin.id,
    });
    const [entry] = await db
      .select({ id: registrationGameEntries.id })
      .from(registrationGameEntries)
      .where(eq(registrationGameEntries.registrationId, registration.id));
    ids.push(entry.id);
  }
  return ids;
}

async function closeRegistration(gameId: string, capacity = 16) {
  await updateTournamentGame({
    actorId: admin.id,
    tournamentGameId: gameId,
    config: {
      description: null,
      feeTaka: 50,
      capacity,
      availability: "CLOSED",
      rules: null,
      sortOrder: 0,
    },
  });
}

async function setScoring(
  gameId: string,
  scoringAdapter: ScoringAdapterKey,
  progressionMode:
    "AUTOMATIC_SINGLE_ELIMINATION" | "MANUAL" = "AUTOMATIC_SINGLE_ELIMINATION",
  config: unknown = {},
) {
  await updateScoringRules({
    actorId: admin.id,
    tournamentGameId: gameId,
    scoringAdapter,
    progressionMode,
    config,
  });
}

async function bracketMatches(gameId: string) {
  return getDatabase()
    .select({
      id: matches.id,
      code: matches.code,
      status: matches.status,
      version: matches.version,
      sequence: rounds.sequence,
      nextMatchId: matches.nextMatchId,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .where(eq(rounds.tournamentGameId, gameId))
    .orderBy(asc(rounds.sequence), asc(matches.code));
}

async function entrants(matchId: string) {
  return getDatabase()
    .select({
      seat: matchEntries.seat,
      entryId: matchEntries.registrationGameEntryId,
      placement: matchEntries.placement,
    })
    .from(matchEntries)
    .where(eq(matchEntries.matchId, matchId))
    .orderBy(asc(matchEntries.seat));
}

function send(
  matchId: string,
  command: ScoreCommand,
  actor: MatchActor = admin,
  clientEventId = randomUUID(),
) {
  return executeScoreCommand({
    actor,
    matchId,
    clientEventId,
    deviceTime: new Date(),
    command,
  });
}

async function version(matchId: string) {
  const [row] = await getDatabase()
    .select({ version: matches.version })
    .from(matches)
    .where(eq(matches.id, matchId));
  return row.version;
}

const goal = (seat: number): ScoreCommand => ({
  type: "EVENT",
  event: { type: "GOAL", seat },
});

// A knockout game with `players` confirmed and the draw made.
async function knockout(
  players: number,
  adapter: ScoringAdapterKey = "GOALS",
  config: unknown = {},
) {
  const gameId = gameIds.Chess;
  const entries = await confirmPlayers(gameId, players);
  await closeRegistration(gameId);
  await setScoring(gameId, adapter, "AUTOMATIC_SINGLE_ELIMINATION", config);
  await generateBracket({
    actorId: admin.id,
    tournamentGameId: gameId,
    seeding: "RANDOM",
  });
  return { gameId, entries, matches: await bracketMatches(gameId) };
}

beforeEach(async () => {
  await resetDatabase();
  admin = { id: await createStaff("SUPER_ADMIN"), role: "SUPER_ADMIN" };
  ({ tournamentId, gameIds } = await seedOpenEvent(admin.id, {
    Chess: 16,
    Ludo: 16,
  }));
});

describe("bracket generation", () => {
  it("draws confirmed players only, with byes, after registration closes", async () => {
    const gameId = gameIds.Chess;
    await confirmPlayers(gameId, 5);
    // A pending registration blocks the draw until it is reviewed.
    await submitRegistration(registrationInput(tournamentId, [gameId]));

    await expect(
      generateBracket({
        actorId: admin.id,
        tournamentGameId: gameId,
        seeding: "RANDOM",
      }),
    ).rejects.toMatchObject({ code: "registration_open" });
    await closeRegistration(gameId);
    await expect(
      generateBracket({
        actorId: admin.id,
        tournamentGameId: gameId,
        seeding: "RANDOM",
      }),
    ).rejects.toMatchObject({ code: "pending_reviews" });

    const [pending] = await getDatabase()
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.status, "PENDING_REVIEW"));
    await reviewRegistration({
      registrationId: pending.id,
      decision: "REJECT",
      reason: "Payment not found",
      actorStaffId: admin.id,
    });

    const result = await generateBracket({
      actorId: admin.id,
      tournamentGameId: gameId,
      seeding: "RANDOM",
    });
    expect(result).toEqual({ players: 5, rounds: 3 });

    const rows = await bracketMatches(gameId);
    // 1 first-round match, 2 semi-finals, 1 final.
    expect(rows.map((row) => row.sequence)).toEqual([1, 2, 2, 3]);
    const placed = await getDatabase()
      .select({ id: matchEntries.id })
      .from(matchEntries)
      .innerJoin(matches, eq(matchEntries.matchId, matches.id))
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .where(eq(rounds.tournamentGameId, gameId));
    expect(placed).toHaveLength(5);

    await expect(
      generateBracket({
        actorId: admin.id,
        tournamentGameId: gameId,
        seeding: "RANDOM",
      }),
    ).rejects.toMatchObject({ code: "bracket_exists" });
    // Reopening registration would leave new players out of the draw.
    await expect(
      updateTournamentGame({
        actorId: admin.id,
        tournamentGameId: gameId,
        config: {
          description: null,
          feeTaka: 50,
          capacity: 16,
          availability: "OPEN",
          rules: null,
          sortOrder: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "bracket_exists" });

    await resetBracket({ actorId: admin.id, tournamentGameId: gameId });
    expect(await bracketMatches(gameId)).toHaveLength(0);
  });

  it("honours a manual seeding order", async () => {
    const gameId = gameIds.Chess;
    await confirmPlayers(gameId, 4);
    await closeRegistration(gameId);
    const codes = (
      await getDatabase()
        .select({ code: registrations.code })
        .from(registrations)
        .orderBy(asc(registrations.code))
    ).map((row) => row.code);

    await expect(
      generateBracket({
        actorId: admin.id,
        tournamentGameId: gameId,
        seeding: "MANUAL",
        manualOrder: codes.slice(0, 3),
      }),
    ).rejects.toMatchObject({ code: "seeding_mismatch" });
    await generateBracket({
      actorId: admin.id,
      tournamentGameId: gameId,
      seeding: "MANUAL",
      manualOrder: codes,
    });

    const seeds = await getDatabase()
      .select({ code: registrations.code, seed: registrationGameEntries.seed })
      .from(registrationGameEntries)
      .innerJoin(
        registrations,
        eq(registrationGameEntries.registrationId, registrations.id),
      )
      .orderBy(asc(registrationGameEntries.seed));
    expect(seeds.map((row) => row.code)).toEqual(codes);
  });
});

describe("score commands", () => {
  it("applies ten simultaneous deltas exactly once each, in sequence", async () => {
    const { matches: rows } = await knockout(2);
    const final = rows[0];

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        send(final.id, goal(index % 2 === 0 ? 1 : 2)),
      ),
    );
    expect(results.every((result) => !result.duplicate)).toBe(true);

    const log = await getDatabase()
      .select({
        version: matchUpdates.matchVersion,
        createdAt: matchUpdates.createdAt,
      })
      .from(matchUpdates)
      .where(eq(matchUpdates.matchId, final.id))
      .orderBy(asc(matchUpdates.matchVersion));
    expect(log.map((row) => row.version)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    // Server times follow the sequence.
    for (let index = 1; index < log.length; index += 1) {
      expect(log[index].createdAt.getTime()).toBeGreaterThanOrEqual(
        log[index - 1].createdAt.getTime(),
      );
    }
    const state = await getMatchState(final.id, admin);
    expect(state?.score).toEqual({
      regular: [5, 5],
      extraTime: null,
      penalties: null,
    });
    expect(state?.status).toBe("IN_PROGRESS");
    expect(state?.version).toBe(11);
  });

  it("applies a retried event once, even when the retries race", async () => {
    const { matches: rows } = await knockout(2);
    const clientEventId = randomUUID();
    const results = await Promise.all([
      send(rows[0].id, goal(1), admin, clientEventId),
      send(rows[0].id, goal(1), admin, clientEventId),
      send(rows[0].id, goal(1), admin, clientEventId),
    ]);
    expect(results.filter((result) => result.duplicate)).toHaveLength(2);
    const state = await getMatchState(rows[0].id, admin);
    expect(state?.score).toMatchObject({ regular: [1, 0] });

    // An event id belongs to one match.
    const other = await knockoutSecondGame();
    await expect(
      send(other, goal(1), admin, clientEventId),
    ).rejects.toMatchObject({ code: "DUPLICATE_EVENT" });
  });

  it("lets exactly one of two racing finalizations win", async () => {
    const { matches: rows } = await knockout(2);
    const final = rows[0];
    await send(final.id, goal(1));
    const seen = await version(final.id);

    const outcomes = await Promise.allSettled([
      send(final.id, { type: "FINALIZE", expectedVersion: seen }),
      send(final.id, {
        type: "SET_SCORE",
        expectedVersion: seen,
        score: { regular: [0, 3] },
      }),
    ]);
    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    );
    const rejected = outcomes.filter(
      (outcome) => outcome.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "STALE_MATCH_VERSION",
    });
  });

  it("never lets a stale typed score overwrite newer goals", async () => {
    const { matches: rows } = await knockout(2);
    const final = rows[0];
    const seen = await version(final.id);
    await send(final.id, goal(2));
    await expect(
      send(final.id, {
        type: "SET_SCORE",
        expectedVersion: seen,
        score: { regular: [3, 0] },
      }),
    ).rejects.toMatchObject({ code: "STALE_MATCH_VERSION" });
    expect((await getMatchState(final.id, admin))?.score).toMatchObject({
      regular: [0, 1],
    });
  });

  it("undoes one event and keeps it in the history", async () => {
    const { matches: rows } = await knockout(2);
    const final = rows[0];
    await send(final.id, goal(1));
    await send(final.id, goal(1));
    const [first] = await getDatabase()
      .select({ id: matchUpdates.id })
      .from(matchUpdates)
      .where(
        and(
          eq(matchUpdates.matchId, final.id),
          eq(matchUpdates.updateType, "SCORE_EVENT"),
        ),
      )
      .orderBy(asc(matchUpdates.matchVersion))
      .limit(1);

    await send(final.id, { type: "VOID", updateId: first.id });
    const state = await getMatchState(final.id, admin);
    expect(state?.score).toMatchObject({ regular: [1, 0] });
    expect(state?.log.find((item) => item.id === first.id)?.voided).toBe(true);

    await expect(
      send(final.id, { type: "VOID", updateId: first.id }),
    ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
  });

  it("rejects an invalid score without writing anything", async () => {
    const { matches: rows } = await knockout(2, "SETS", { bestOf: 3 });
    const final = rows[0];
    await expect(
      send(final.id, {
        type: "EVENT",
        event: { type: "SET", set: 1, points: [15, 3] },
      }),
    ).rejects.toMatchObject({ code: "INVALID_SCORE" });
    expect(await version(final.id)).toBe(1);
    const log = await getDatabase()
      .select()
      .from(matchUpdates)
      .where(eq(matchUpdates.matchId, final.id));
    expect(log).toHaveLength(0);
  });
});

describe("finalization and progression", () => {
  it("advances winners, including byes, and completes the bracket", async () => {
    const { matches: rows } = await knockout(3, "CHESS_OUTCOME");
    const [first, final] = rows;
    expect(final.nextMatchId).toBeNull();

    // The final waits for the first-round match.
    await expect(
      send(final.id, {
        type: "FINALIZE",
        expectedVersion: 1,
        score: { winnerSeat: 1 },
      }),
    ).rejects.toMatchObject({ code: "NOT_READY" });

    const [, second] = await entrants(first.id);
    await send(first.id, {
      type: "FINALIZE",
      expectedVersion: 1,
      score: { winnerSeat: second.seat },
    });

    const finalEntrants = await entrants(final.id);
    expect(finalEntrants.map((row) => row.entryId)).toContain(second.entryId);
    expect(finalEntrants).toHaveLength(2);

    const finalVersion = await version(final.id);
    await send(final.id, {
      type: "FINALIZE",
      expectedVersion: finalVersion,
      score: { winnerSeat: 1 },
    });
    const done = await bracketMatches(gameIds.Chess);
    expect(done.every((row) => row.status === "COMPLETED")).toBe(true);
    const roundStatuses = await getDatabase()
      .select({ status: rounds.status })
      .from(rounds)
      .where(eq(rounds.tournamentGameId, gameIds.Chess));
    expect(roundStatuses.every((row) => row.status === "COMPLETED")).toBe(true);

    const audits = await getDatabase()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "MATCH_FINALIZED"));
    expect(audits).toHaveLength(2);
    // Finished matches are closed to further scoring.
    await expect(send(final.id, goal(1))).rejects.toMatchObject({
      code: "MATCH_CLOSED",
    });
  });

  it("lands two sibling results in the same next match without deadlock", async () => {
    const { matches: rows } = await knockout(4, "CHESS_OUTCOME");
    const semis = rows.filter((row) => row.sequence === 1);
    const final = rows.find((row) => row.sequence === 2)!;
    expect(semis).toHaveLength(2);

    await Promise.all(
      semis.map((semi) =>
        send(semi.id, {
          type: "FINALIZE",
          expectedVersion: 1,
          score: { winnerSeat: 1 },
        }),
      ),
    );
    const finalEntrants = await entrants(final.id);
    expect(finalEntrants.map((row) => row.seat)).toEqual([1, 2]);
    expect(await version(final.id)).toBe(3);
  });

  it("records a walkover and moves the present player on", async () => {
    const { matches: rows } = await knockout(4, "CHESS_OUTCOME");
    const semi = rows[0];
    const final = rows.find((row) => row.sequence === 2)!;
    const [present] = await entrants(semi.id);

    await send(semi.id, {
      type: "WALKOVER",
      expectedVersion: 1,
      absentSeats: [2],
      note: "Did not report",
    });
    const state = await getMatchState(semi.id, admin);
    expect(state?.status).toBe("WALKOVER");
    expect(state?.entrants.find((row) => row.seat === 2)?.outcome).toBe("DNS");
    expect((await entrants(final.id)).map((row) => row.entryId)).toContain(
      present.entryId,
    );

    await expect(
      send(rows[1].id, {
        type: "WALKOVER",
        expectedVersion: 1,
        absentSeats: [],
      }),
    ).rejects.toMatchObject({ code: "INVALID_SCORE" });
  });

  it("reopens a result, withdraws the advanced winner and re-advances the corrected one", async () => {
    const { matches: rows } = await knockout(4, "CHESS_OUTCOME");
    const semi = rows[0];
    const otherSemi = rows[1];
    const final = rows.find((row) => row.sequence === 2)!;
    const [seat1, seat2] = await entrants(semi.id);

    await send(semi.id, {
      type: "FINALIZE",
      expectedVersion: 1,
      score: { winnerSeat: 1 },
    });
    expect((await entrants(final.id)).map((row) => row.entryId)).toEqual([
      seat1.entryId,
    ]);

    await expect(
      reopenMatch({ actor: admin, matchId: semi.id, reason: "x" }),
    ).rejects.toMatchObject({
      code: "REASON_REQUIRED",
    });
    await reopenMatch({
      actor: admin,
      matchId: semi.id,
      reason: "Wrong winner entered",
    });
    expect(await entrants(final.id)).toHaveLength(0);
    expect(
      (await entrants(semi.id)).every((row) => row.placement === null),
    ).toBe(true);

    await send(semi.id, {
      type: "FINALIZE",
      expectedVersion: await version(semi.id),
      score: { winnerSeat: 2 },
    });
    expect((await entrants(final.id)).map((row) => row.entryId)).toEqual([
      seat2.entryId,
    ]);

    // Once the final is under way, the semi-final can no longer be reopened.
    await send(otherSemi.id, {
      type: "FINALIZE",
      expectedVersion: 1,
      score: { winnerSeat: 1 },
    });
    await send(final.id, { type: "START" });
    await expect(
      reopenMatch({
        actor: admin,
        matchId: semi.id,
        reason: "Another correction",
      }),
    ).rejects.toMatchObject({
      code: "DOWNSTREAM_RESULT_DEPENDENCY",
    });

    const reasons = await getDatabase()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "MATCH_REOPENED"));
    expect(reasons[0].reason).toBe("Wrong winner entered");
  });
});

describe("operators", () => {
  it("can score only within their assignment, re-checked on every command", async () => {
    const { gameId, matches: rows } = await knockout(4, "GOALS");
    const operatorId = await createStaff("SCORE_OPERATOR");
    const operator: MatchActor = { id: operatorId, role: "SCORE_OPERATOR" };

    await expect(send(rows[0].id, goal(1), operator)).rejects.toMatchObject({
      code: "UNAUTHORIZED_SCOPE",
    });

    await grantOperatorAssignment({
      actorId: admin.id,
      operatorId,
      tournamentId,
      scopeType: "MATCH",
      targetId: rows[0].id,
      capabilities: ["VIEW", "SCORE_UPDATE"],
    });
    await send(rows[0].id, goal(1), operator);
    await expect(send(rows[1].id, goal(1), operator)).rejects.toMatchObject({
      code: "UNAUTHORIZED_SCOPE",
    });
    // Scoring rights do not include finalizing.
    await expect(
      send(
        rows[0].id,
        { type: "FINALIZE", expectedVersion: await version(rows[0].id) },
        operator,
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_SCOPE" });

    const assignment = await grantOperatorAssignment({
      actorId: admin.id,
      operatorId,
      tournamentId,
      scopeType: "GAME",
      targetId: gameId,
      capabilities: ["VIEW", "SCORE_UPDATE", "FINALIZE_MATCH"],
    });
    await send(
      rows[0].id,
      { type: "FINALIZE", expectedVersion: await version(rows[0].id) },
      operator,
    );

    await revokeOperatorAssignment({
      actorId: admin.id,
      operatorId,
      assignmentId: assignment,
    });
    await expect(send(rows[1].id, goal(2), operator)).rejects.toMatchObject({
      code: "UNAUTHORIZED_SCOPE",
    });

    // Operators cannot correct finished results.
    await expect(
      reopenMatch({
        actor: operator,
        matchId: rows[0].id,
        reason: "Please reopen",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED_SCOPE",
    });
  });
});

describe("scoring rules", () => {
  it("freeze once play starts", async () => {
    const { gameId, matches: rows } = await knockout(2, "GOALS");
    await expect(setScoring(gameId, "SETS")).rejects.toMatchObject({
      code: "bracket_exists",
    });
    await setScoring(gameId, "GOALS", "AUTOMATIC_SINGLE_ELIMINATION", {
      extraTime: false,
    });

    await send(rows[0].id, goal(1));
    expect(await getScoringLock(getDatabase(), gameId)).toEqual({
      hasRounds: true,
      started: true,
    });
    await expect(
      setScoring(gameId, "GOALS", "AUTOMATIC_SINGLE_ELIMINATION", {}),
    ).rejects.toMatchObject({
      code: "scoring_locked",
    });
    await expect(
      send(rows[0].id, {
        type: "EVENT",
        event: { type: "GOAL", seat: 1, phase: "EXTRA_TIME" },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_SCORE",
    });
  });
});

describe("manual progression", () => {
  it("runs a four-player table and records placements without advancing anyone", async () => {
    const gameId = gameIds.Ludo;
    const players = await confirmPlayers(gameId, 5);
    await closeRegistration(gameId);
    await setScoring(gameId, "MULTIPLAYER_POINTS", "MANUAL", {
      allowSharedPlacement: false,
    });

    await expect(
      generateBracket({
        actorId: admin.id,
        tournamentGameId: gameId,
        seeding: "RANDOM",
      }),
    ).rejects.toMatchObject({ code: "not_knockout" });

    const roundId = await addRound({
      actorId: admin.id,
      tournamentGameId: gameId,
      name: "Table round",
    });
    await expect(
      addManualMatch({
        actorId: admin.id,
        roundId,
        registrationGameEntryIds: [players[0]],
        scheduledAt: null,
        station: null,
      }),
    ).rejects.toMatchObject({ code: "wrong_player_count" });
    const matchId = await addManualMatch({
      actorId: admin.id,
      roundId,
      registrationGameEntryIds: players.slice(0, 4),
      scheduledAt: null,
      station: "Table 2",
    });

    await send(matchId, {
      type: "EVENT",
      event: { type: "HAND", deltas: { "1": 3, "2": 1, "3": 2, "4": 0 } },
    });
    await send(matchId, {
      type: "FINALIZE",
      expectedVersion: await version(matchId),
    });
    const state = await getMatchState(matchId, admin);
    expect(state?.status).toBe("COMPLETED");
    expect(state?.entrants.map((row) => row.placement)).toEqual([1, 3, 2, 4]);
    expect(
      (state?.result as { winnerEntryIds: string[] }).winnerEntryIds,
    ).toEqual([players[0]]);
  });
});

async function knockoutSecondGame() {
  const gameId = gameIds.Ludo;
  await confirmPlayers(gameId, 2);
  await closeRegistration(gameId);
  await setScoring(gameId, "GOALS");
  await generateBracket({
    actorId: admin.id,
    tournamentGameId: gameId,
    seeding: "RANDOM",
  });
  return (await bracketMatches(gameId))[0].id;
}
