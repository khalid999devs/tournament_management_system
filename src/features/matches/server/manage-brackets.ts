import "server-only";

import { randomInt } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, max, or, sql } from "drizzle-orm";
import { getDatabase, type Database } from "@/db";
import {
  auditLogs,
  games,
  matchEntries,
  matches,
  matchUpdates,
  operatorAssignments,
  registrationGameEntries,
  registrations,
  rounds,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import { getScoringAdapter } from "@/features/scoring/adapters";
import {
  buildSingleElimination,
  matchCodePrefix,
  shuffle,
} from "../domain/bracket";

export class BracketError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "BracketError";
  }
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function lockGame(tx: Tx, tournamentGameId: string) {
  const [game] = await tx
    .select({
      id: tournamentGames.id,
      tournamentId: tournamentGames.tournamentId,
      tournamentStatus: tournaments.status,
      status: tournamentGames.status,
      registrationOpen: tournamentGames.registrationOpen,
      reservedCount: tournamentGames.reservedCount,
      progressionMode: tournamentGames.progressionMode,
      scoringAdapter: tournamentGames.scoringAdapter,
      name: games.name,
    })
    .from(tournamentGames)
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
    .where(eq(tournamentGames.id, tournamentGameId))
    .limit(1)
    .for("update", { of: tournamentGames });

  if (!game || game.status === "ARCHIVED")
    throw new BracketError("game_not_found");
  if (["COMPLETED", "ARCHIVED"].includes(game.tournamentStatus)) {
    throw new BracketError("tournament_closed");
  }
  return game;
}

async function confirmedEntries(tx: Tx, tournamentGameId: string) {
  return tx
    .select({ id: registrationGameEntries.id, code: registrations.code })
    .from(registrationGameEntries)
    .innerJoin(
      registrations,
      eq(registrationGameEntries.registrationId, registrations.id),
    )
    .where(
      and(
        eq(registrationGameEntries.tournamentGameId, tournamentGameId),
        eq(registrationGameEntries.status, "CONFIRMED"),
        eq(registrations.status, "CONFIRMED"),
      ),
    )
    .orderBy(asc(registrations.submittedAt), asc(registrationGameEntries.id));
}

const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

// Builds the whole single-elimination draw in one transaction from the
// confirmed entries only. Registration must be closed and every payment
// reviewed first, so nobody who is still being approved is left out.
export async function generateBracket(input: {
  actorId: string;
  tournamentGameId: string;
  seeding: "RANDOM" | "MANUAL";
  manualOrder?: string[];
}) {
  return getDatabase().transaction(async (tx) => {
    const game = await lockGame(tx, input.tournamentGameId);
    if (game.progressionMode !== "AUTOMATIC_SINGLE_ELIMINATION") {
      throw new BracketError("not_knockout");
    }
    if (game.registrationOpen) throw new BracketError("registration_open");
    if (game.reservedCount > 0) throw new BracketError("pending_reviews");

    const [existing] = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.tournamentGameId, game.id))
      .limit(1);
    if (existing) throw new BracketError("bracket_exists");

    const entries = await confirmedEntries(tx, game.id);
    if (entries.length < 2) throw new BracketError("too_few_players");

    let seeded: string[];
    if (input.seeding === "MANUAL") {
      const byCode = new Map(
        entries.map((entry) => [entry.code.toUpperCase(), entry.id]),
      );
      const order = (input.manualOrder ?? [])
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      if (
        order.length !== entries.length ||
        new Set(order).size !== order.length ||
        order.some((code) => !byCode.has(code))
      ) {
        throw new BracketError("seeding_mismatch");
      }
      seeded = order.map((code) => byCode.get(code)!);
    } else {
      seeded = shuffle(
        entries.map((entry) => entry.id),
        secureRandom,
      );
    }

    const plan = buildSingleElimination(seeded, matchCodePrefix(game.name));

    // Insert later rounds first so each match can point at its next match.
    const matchIds = new Map<string, string>();
    for (const round of [...plan].reverse()) {
      const [roundRow] = await tx
        .insert(rounds)
        .values({
          tournamentGameId: game.id,
          name: round.name,
          sequence: round.sequence,
          status: "SCHEDULED",
          metadata: { format: "SINGLE_ELIMINATION", seeding: input.seeding },
        })
        .returning({ id: rounds.id });

      for (const match of round.matches) {
        const [matchRow] = await tx
          .insert(matches)
          .values({
            roundId: roundRow.id,
            code: match.code,
            nextMatchId: match.next
              ? matchIds.get(`${match.next.round}:${match.next.slot}`)!
              : null,
            nextMatchSeat: match.next?.seat ?? null,
          })
          .returning({ id: matches.id });
        matchIds.set(`${round.sequence}:${match.slot}`, matchRow.id);

        const seats = match.seats
          .map((entryId, index) => ({ entryId, seat: index + 1 }))
          .filter(
            (seat): seat is { entryId: string; seat: number } =>
              seat.entryId !== null,
          );
        if (seats.length > 0) {
          await tx.insert(matchEntries).values(
            seats.map((seat) => ({
              matchId: matchRow.id,
              registrationGameEntryId: seat.entryId,
              seat: seat.seat,
            })),
          );
        }
      }
    }

    for (const [index, entryId] of seeded.entries()) {
      await tx
        .update(registrationGameEntries)
        .set({ seed: index + 1, updatedAt: new Date() })
        .where(eq(registrationGameEntries.id, entryId));
    }

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "BRACKET_GENERATED",
      entityType: "tournament_game",
      entityId: game.id,
      after: {
        seeding: input.seeding,
        players: seeded.length,
        rounds: plan.length,
        matches: plan.reduce((total, round) => total + round.matches.length, 0),
      },
    });

    return { players: seeded.length, rounds: plan.length };
  });
}

async function assertUnplayed(tx: Tx, where: ReturnType<typeof eq>) {
  const [played] = await tx
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .where(
      and(
        where,
        or(isNotNull(matches.startedAt), sql`${matches.status} <> 'SCHEDULED'`),
      ),
    )
    .limit(1);
  if (played) throw new BracketError("matches_started");
}

async function assertNoAssignments(
  tx: Tx,
  roundIds: string[],
  matchIds: string[],
) {
  if (roundIds.length === 0 && matchIds.length === 0) return;
  const conditions = [];
  if (roundIds.length)
    conditions.push(inArray(operatorAssignments.roundId, roundIds));
  if (matchIds.length)
    conditions.push(inArray(operatorAssignments.matchId, matchIds));
  const [assigned] = await tx
    .select({ id: operatorAssignments.id })
    .from(operatorAssignments)
    .where(or(...conditions))
    .limit(1);
  if (assigned) throw new BracketError("has_assignments");
}

async function deleteMatches(tx: Tx, matchIds: string[]) {
  if (matchIds.length === 0) return;
  // Voids reference other updates; clear them before the updates they void.
  await tx
    .delete(matchUpdates)
    .where(
      and(
        inArray(matchUpdates.matchId, matchIds),
        isNotNull(matchUpdates.voidsUpdateId),
      ),
    );
  await tx.delete(matchUpdates).where(inArray(matchUpdates.matchId, matchIds));
  await tx.delete(matchEntries).where(inArray(matchEntries.matchId, matchIds));
  await tx.delete(matches).where(inArray(matches.id, matchIds));
}

// Undo a draw before any match is played, e.g. after a late withdrawal.
export async function resetBracket(input: {
  actorId: string;
  tournamentGameId: string;
}) {
  return getDatabase().transaction(async (tx) => {
    const game = await lockGame(tx, input.tournamentGameId);
    await assertUnplayed(tx, eq(rounds.tournamentGameId, game.id));

    const roundRows = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.tournamentGameId, game.id));
    const roundIds = roundRows.map((row) => row.id);
    if (roundIds.length === 0) throw new BracketError("no_bracket");

    const matchRows = await tx
      .select({ id: matches.id })
      .from(matches)
      .where(inArray(matches.roundId, roundIds));
    const matchIds = matchRows.map((row) => row.id);

    await assertNoAssignments(tx, roundIds, matchIds);
    await deleteMatches(tx, matchIds);
    await tx.delete(rounds).where(inArray(rounds.id, roundIds));
    await tx
      .update(registrationGameEntries)
      .set({ seed: null, updatedAt: new Date() })
      .where(eq(registrationGameEntries.tournamentGameId, game.id));

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "BRACKET_RESET",
      entityType: "tournament_game",
      entityId: game.id,
      before: { rounds: roundIds.length, matches: matchIds.length },
    });
  });
}

// ---------------------------------------------------------------------------
// Manual progression: the admin builds each round and picks who plays.

export async function addRound(input: {
  actorId: string;
  tournamentGameId: string;
  name: string;
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120)
    throw new BracketError("invalid_round");

  return getDatabase().transaction(async (tx) => {
    const game = await lockGame(tx, input.tournamentGameId);
    if (game.progressionMode !== "MANUAL") throw new BracketError("not_manual");

    const [{ last }] = await tx
      .select({ last: max(rounds.sequence) })
      .from(rounds)
      .where(eq(rounds.tournamentGameId, game.id));
    const [round] = await tx
      .insert(rounds)
      .values({
        tournamentGameId: game.id,
        name,
        sequence: (last ?? 0) + 1,
        status: "SCHEDULED",
        metadata: { format: "MANUAL" },
      })
      .returning({ id: rounds.id });

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "ROUND_CREATED",
      entityType: "round",
      entityId: round.id,
      after: { name, tournamentGameId: game.id },
    });
    return round.id;
  });
}

export async function addManualMatch(input: {
  actorId: string;
  roundId: string;
  registrationGameEntryIds: string[];
  scheduledAt: Date | null;
  station: string | null;
}) {
  const entryIds = [...new Set(input.registrationGameEntryIds)];

  return getDatabase().transaction(async (tx) => {
    const [round] = await tx
      .select({
        id: rounds.id,
        sequence: rounds.sequence,
        tournamentGameId: rounds.tournamentGameId,
      })
      .from(rounds)
      .where(eq(rounds.id, input.roundId))
      .limit(1);
    if (!round) throw new BracketError("round_not_found");

    const game = await lockGame(tx, round.tournamentGameId);
    if (game.progressionMode !== "MANUAL") throw new BracketError("not_manual");

    const adapter = getScoringAdapter(game.scoringAdapter);
    if (
      entryIds.length < adapter.seats.min ||
      entryIds.length > adapter.seats.max
    ) {
      throw new BracketError("wrong_player_count");
    }

    const valid = await confirmedEntries(tx, game.id);
    const validIds = new Set(valid.map((entry) => entry.id));
    if (entryIds.some((id) => !validIds.has(id)))
      throw new BracketError("player_not_confirmed");

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(eq(matches.roundId, round.id));
    const code = `${matchCodePrefix(game.name)}-R${round.sequence}-${String(count + 1).padStart(2, "0")}`;

    const [match] = await tx
      .insert(matches)
      .values({
        roundId: round.id,
        code,
        scheduledAt: input.scheduledAt,
        station: input.station,
      })
      .returning({ id: matches.id });
    await tx.insert(matchEntries).values(
      entryIds.map((registrationGameEntryId, index) => ({
        matchId: match.id,
        registrationGameEntryId,
        seat: index + 1,
      })),
    );

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "MATCH_CREATED",
      entityType: "match",
      entityId: match.id,
      after: { code, roundId: round.id, registrationGameEntryIds: entryIds },
    });
    return match.id;
  });
}

export async function deleteManualMatch(input: {
  actorId: string;
  matchId: string;
}) {
  return getDatabase().transaction(async (tx) => {
    const [match] = await tx
      .select({
        id: matches.id,
        code: matches.code,
        tournamentGameId: rounds.tournamentGameId,
      })
      .from(matches)
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .where(eq(matches.id, input.matchId))
      .limit(1);
    if (!match) throw new BracketError("match_not_found");

    const game = await lockGame(tx, match.tournamentGameId);
    if (game.progressionMode !== "MANUAL") throw new BracketError("not_manual");
    await assertUnplayed(tx, eq(matches.id, match.id));
    await assertNoAssignments(tx, [], [match.id]);
    await deleteMatches(tx, [match.id]);

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "MATCH_DELETED",
      entityType: "match",
      entityId: match.id,
      before: { code: match.code },
    });
  });
}
