import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  games,
  matchEntries,
  matches,
  participants,
  registrationGameEntries,
  registrations,
  rounds,
  tournamentGames,
} from "@/db/schema";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { getScoringLock } from "@/features/event/server/manage-event";
import type { MatchStatus } from "../domain/commands";

const pageSize = 25;
const statuses: MatchStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "WALKOVER",
  "POSTPONED",
  "CANCELLED",
];

async function entrantNames(matchIds: string[]) {
  if (matchIds.length === 0)
    return new Map<
      string,
      { seat: number; name: string; placement: number | null }[]
    >();
  const rows = await getDatabase()
    .select({
      matchId: matchEntries.matchId,
      seat: matchEntries.seat,
      name: participants.fullName,
      placement: matchEntries.placement,
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
    .where(inArray(matchEntries.matchId, matchIds))
    .orderBy(asc(matchEntries.seat));

  const byMatch = new Map<
    string,
    { seat: number; name: string; placement: number | null }[]
  >();
  for (const row of rows) {
    const list = byMatch.get(row.matchId) ?? [];
    list.push({ seat: row.seat, name: row.name, placement: row.placement });
    byMatch.set(row.matchId, list);
  }
  return byMatch;
}

// Tournament-wide monitor: filtered and paginated on the server (PRD 12.2).
export async function getAdminMatchPage(options: {
  game?: string;
  status?: string;
  q?: string;
  page?: string;
}) {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  if (!tournamentId) return null;

  const gameOptions = await db
    .select({ id: tournamentGames.id, name: games.name })
    .from(tournamentGames)
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(
      and(
        eq(tournamentGames.tournamentId, tournamentId),
        sql`${tournamentGames.status} <> 'ARCHIVED'`,
      ),
    )
    .orderBy(asc(tournamentGames.sortOrder), asc(games.name));

  const game = gameOptions.some((item) => item.id === options.game)
    ? options.game!
    : "";
  const status = statuses.includes(options.status as MatchStatus)
    ? (options.status as MatchStatus)
    : "";
  const search = options.q?.trim().slice(0, 80) ?? "";
  const requestedPage = Number(options.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const conditions: SQL[] = [eq(tournamentGames.tournamentId, tournamentId)];
  if (game) conditions.push(eq(tournamentGames.id, game));
  if (status) conditions.push(eq(matches.status, status));
  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
    const entrant = db
      .select({ id: matchEntries.id })
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
      .where(
        and(
          eq(matchEntries.matchId, matches.id),
          or(
            ilike(participants.fullName, pattern),
            ilike(registrations.code, pattern),
          ),
        ),
      );
    conditions.push(or(ilike(matches.code, pattern), exists(entrant))!);
  }
  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  const rows = await db
    .select({
      id: matches.id,
      code: matches.code,
      status: matches.status,
      displayScore: matches.displayScore,
      scheduledAt: matches.scheduledAt,
      station: matches.station,
      updatedAt: matches.updatedAt,
      version: matches.version,
      gameName: games.name,
      roundName: rounds.name,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(where)
    .orderBy(
      sql`case ${matches.status} when 'IN_PROGRESS' then 0 when 'POSTPONED' then 1 when 'SCHEDULED' then 2 else 3 end`,
      desc(matches.updatedAt),
      matches.id,
    )
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  const names = await entrantNames(rows.map((row) => row.id));

  const [counts] = await db
    .select({
      live: sql<number>`count(*) filter (where ${matches.status} = 'IN_PROGRESS')::int`,
      scheduled: sql<number>`count(*) filter (where ${matches.status} = 'SCHEDULED')::int`,
      finished: sql<number>`count(*) filter (where ${matches.status} in ('COMPLETED', 'WALKOVER'))::int`,
      held: sql<number>`count(*) filter (where ${matches.status} in ('POSTPONED', 'CANCELLED'))::int`,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(eq(tournamentGames.tournamentId, tournamentId));

  return {
    rows: rows.map((row) => ({ ...row, entrants: names.get(row.id) ?? [] })),
    total,
    page: currentPage,
    pageCount,
    filters: { game, status, q: search },
    gameOptions,
    counts,
  };
}

// Rounds, matches and the confirmed field for one game's admin page.
export async function getGameBracket(tournamentGameId: string) {
  const db = getDatabase();
  const [roundRows, confirmed, lock, [pending]] = await Promise.all([
    db
      .select({
        id: rounds.id,
        name: rounds.name,
        sequence: rounds.sequence,
        status: rounds.status,
      })
      .from(rounds)
      .where(eq(rounds.tournamentGameId, tournamentGameId))
      .orderBy(asc(rounds.sequence)),
    db
      .select({
        id: registrationGameEntries.id,
        seed: registrationGameEntries.seed,
        code: registrations.code,
        name: participants.fullName,
        department: participants.department,
      })
      .from(registrationGameEntries)
      .innerJoin(
        registrations,
        eq(registrationGameEntries.registrationId, registrations.id),
      )
      .innerJoin(participants, eq(registrations.participantId, participants.id))
      .where(
        and(
          eq(registrationGameEntries.tournamentGameId, tournamentGameId),
          eq(registrationGameEntries.status, "CONFIRMED"),
          eq(registrations.status, "CONFIRMED"),
        ),
      )
      .orderBy(
        asc(registrationGameEntries.seed),
        asc(registrations.submittedAt),
      ),
    getScoringLock(db, tournamentGameId),
    db
      .select({ value: count() })
      .from(registrationGameEntries)
      .where(
        and(
          eq(registrationGameEntries.tournamentGameId, tournamentGameId),
          eq(registrationGameEntries.status, "PENDING"),
        ),
      ),
  ]);

  const matchRows = roundRows.length
    ? await db
        .select({
          id: matches.id,
          roundId: matches.roundId,
          code: matches.code,
          status: matches.status,
          displayScore: matches.displayScore,
          scheduledAt: matches.scheduledAt,
          station: matches.station,
          startedAt: matches.startedAt,
        })
        .from(matches)
        .where(
          inArray(
            matches.roundId,
            roundRows.map((round) => round.id),
          ),
        )
        .orderBy(asc(matches.code))
    : [];
  const names = await entrantNames(matchRows.map((match) => match.id));

  return {
    rounds: roundRows.map((round) => ({
      ...round,
      matches: matchRows
        .filter((match) => match.roundId === round.id)
        .map((match) => ({ ...match, entrants: names.get(match.id) ?? [] })),
    })),
    confirmed,
    pendingCount: pending?.value ?? 0,
    lock,
  };
}
