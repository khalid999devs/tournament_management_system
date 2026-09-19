import "server-only";

import { and, asc, desc, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDatabase, type Database } from "@/db";
import {
  games,
  matchEntries,
  matches,
  matchUpdates,
  participants,
  registrationGameEntries,
  registrations,
  rounds,
  staffProfiles,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import { operatorMatchAccessPredicate } from "@/features/operators/server/workload";
import {
  buildScoringContext,
  getScoringAdapter,
  type ScoringAdapterKey,
} from "@/features/scoring/adapters";
import { finishedStatuses, type MatchStatus } from "../domain/commands";
import type { MatchActor } from "./match-commands";

export type MatchEntrant = {
  seat: number;
  registrationGameEntryId: string;
  name: string;
  registrationCode: string;
  department: string;
  placement: number | null;
  points: number | null;
  outcome: string | null;
};

export type MatchLogItem = {
  id: string;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  actorName: string;
  serverTime: string;
  deviceTime: string | null;
  voided: boolean;
};

export type MatchState = {
  id: string;
  code: string;
  status: MatchStatus;
  version: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  venue: string | null;
  station: string | null;
  tournamentStatus: string;
  tournamentGameId: string;
  gameName: string;
  roundName: string;
  adapterKey: ScoringAdapterKey;
  config: unknown;
  progressionMode: "AUTOMATIC_SINGLE_ELIMINATION" | "MANUAL";
  entrants: MatchEntrant[];
  pendingFeeders: number;
  score: unknown;
  displayScore: string | null;
  result: unknown;
  nextMatch: { id: string; code: string } | null;
  log: MatchLogItem[];
  permissions: { score: boolean; finalize: boolean; admin: boolean };
};

const logLimit = 80;

// The operator's view excludes payment data by construction: only the
// participant's name, department and registration code are read.
export async function getMatchState(
  matchId: string,
  actor: MatchActor,
): Promise<MatchState | null> {
  // One snapshot, so the version, score and history always agree.
  return getDatabase().transaction((tx) => readMatchState(tx, matchId, actor), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

type Reader = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function readMatchState(
  db: Reader,
  matchId: string,
  actor: MatchActor,
): Promise<MatchState | null> {
  const nextMatch = alias(matches, "next_match");
  const isAdmin = actor.role === "SUPER_ADMIN";

  const [row] = await db
    .select({
      id: matches.id,
      code: matches.code,
      status: matches.status,
      version: matches.version,
      scheduledAt: matches.scheduledAt,
      startedAt: matches.startedAt,
      completedAt: matches.completedAt,
      venue: matches.venue,
      station: matches.station,
      scoreData: matches.scoreData,
      displayScore: matches.displayScore,
      resultData: matches.resultData,
      nextMatchId: matches.nextMatchId,
      nextMatchCode: nextMatch.code,
      tournamentStatus: tournaments.status,
      tournamentGameId: tournamentGames.id,
      gameName: games.name,
      roundName: rounds.name,
      adapterKey: tournamentGames.scoringAdapter,
      config: tournamentGames.config,
      progressionMode: tournamentGames.progressionMode,
      canView: isAdmin
        ? sql<boolean>`true`
        : sql<boolean>`${operatorMatchAccessPredicate(actor.id, "VIEW", db)}`,
      canScore: isAdmin
        ? sql<boolean>`true`
        : sql<boolean>`${operatorMatchAccessPredicate(actor.id, "SCORE_UPDATE", db)}`,
      canFinalize: isAdmin
        ? sql<boolean>`true`
        : sql<boolean>`${operatorMatchAccessPredicate(actor.id, "FINALIZE_MATCH", db)}`,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .leftJoin(nextMatch, eq(matches.nextMatchId, nextMatch.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!row || !row.canView) return null;

  const [entrants, log, [feeders]] = await Promise.all([
    db
      .select({
        seat: matchEntries.seat,
        registrationGameEntryId: matchEntries.registrationGameEntryId,
        name: participants.fullName,
        registrationCode: registrations.code,
        department: participants.department,
        placement: matchEntries.placement,
        points: matchEntries.points,
        outcome: matchEntries.outcome,
      })
      .from(matchEntries)
      .innerJoin(
        registrationGameEntries,
        eq(matchEntries.registrationGameEntryId, registrationGameEntries.id),
      )
      .innerJoin(
        registrations,
        eq(registrationGameEntries.registrationId, registrations.id),
      )
      .innerJoin(participants, eq(registrations.participantId, participants.id))
      .where(eq(matchEntries.matchId, matchId))
      .orderBy(asc(matchEntries.seat)),
    db
      .select({
        id: matchUpdates.id,
        type: matchUpdates.updateType,
        version: matchUpdates.matchVersion,
        payload: matchUpdates.payload,
        actorName: staffProfiles.displayName,
        serverTime: matchUpdates.createdAt,
        deviceTime: matchUpdates.deviceTime,
        voidsUpdateId: matchUpdates.voidsUpdateId,
      })
      .from(matchUpdates)
      .innerJoin(staffProfiles, eq(matchUpdates.actorStaffId, staffProfiles.id))
      .where(eq(matchUpdates.matchId, matchId))
      .orderBy(desc(matchUpdates.matchVersion))
      .limit(logLimit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(
        and(
          eq(matches.nextMatchId, matchId),
          notInArray(matches.status, finishedStatuses),
        ),
      ),
  ]);

  // Voids can point at events older than the loaded window.
  const voided = new Set(
    (
      await db
        .select({ id: matchUpdates.voidsUpdateId })
        .from(matchUpdates)
        .where(
          and(
            eq(matchUpdates.matchId, matchId),
            isNotNull(matchUpdates.voidsUpdateId),
          ),
        )
    ).map((item) => item.id),
  );

  const adapter = getScoringAdapter(row.adapterKey);
  const context = buildScoringContext({
    adapterKey: row.adapterKey,
    config: row.config,
    seats: entrants.map((entrant) => entrant.seat),
    progressionMode: row.progressionMode,
  });

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    version: row.version,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    venue: row.venue,
    station: row.station,
    tournamentStatus: row.tournamentStatus,
    tournamentGameId: row.tournamentGameId,
    gameName: row.gameName,
    roundName: row.roundName,
    adapterKey: row.adapterKey as ScoringAdapterKey,
    config: context.config,
    progressionMode: row.progressionMode,
    entrants,
    pendingFeeders: feeders?.count ?? 0,
    score: row.scoreData ?? adapter.emptyScore(context),
    displayScore: row.displayScore,
    result: row.resultData,
    nextMatch:
      row.nextMatchId && row.nextMatchCode
        ? { id: row.nextMatchId, code: row.nextMatchCode }
        : null,
    log: log.map((item) => ({
      id: item.id,
      type: item.type,
      version: item.version,
      payload: item.payload,
      actorName: item.actorName,
      serverTime: item.serverTime.toISOString(),
      deviceTime: item.deviceTime?.toISOString() ?? null,
      voided: voided.has(item.id),
    })),
    permissions: {
      score: Boolean(row.canScore),
      finalize: Boolean(row.canFinalize),
      admin: isAdmin,
    },
  };
}

// Cheap poll: returns the current version only if the actor may still see
// the match, so a screen refetches the full state only when something changed.
export async function getMatchVersion(matchId: string, actor: MatchActor) {
  const db = getDatabase();
  const [row] = await db
    .select({ version: matches.version })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(
      actor.role === "SUPER_ADMIN"
        ? eq(matches.id, matchId)
        : and(
            eq(matches.id, matchId),
            operatorMatchAccessPredicate(actor.id, "VIEW", db),
          ),
    )
    .limit(1);
  return row?.version ?? null;
}
