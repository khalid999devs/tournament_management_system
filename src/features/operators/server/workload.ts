import "server-only";

import { and, desc, eq, exists, sql } from "drizzle-orm";
import { getDatabase, type Database } from "@/db";
import {
  games,
  matchEntries,
  matches,
  operatorAssignments,
  rounds,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import type { OperatorCapability } from "@/db/schema/assignments";
import {
  getCurrentStaff,
  StaffAuthorizationError,
} from "@/features/auth/server/staff-session";

const pageSize = 20;

export function operatorMatchAccessPredicate(
  operatorId: string,
  capability: OperatorCapability,
  db: Database = getDatabase(),
) {
  const entryInMatch = db
    .select({ id: matchEntries.id })
    .from(matchEntries)
    .where(
      and(
        eq(matchEntries.matchId, matches.id),
        eq(
          matchEntries.registrationGameEntryId,
          operatorAssignments.registrationGameEntryId,
        ),
      ),
    );

  return exists(
    db
      .select({ id: operatorAssignments.id })
      .from(operatorAssignments)
      .where(
        and(
          eq(operatorAssignments.operatorId, operatorId),
          eq(operatorAssignments.active, true),
          eq(operatorAssignments.tournamentId, tournamentGames.tournamentId),
          sql`${operatorAssignments.capabilities} @> ${JSON.stringify([capability])}::jsonb`,
          sql`(
            ${operatorAssignments.scopeType} = 'ALL_TOURNAMENT'
            or (${operatorAssignments.scopeType} = 'GAME' and ${operatorAssignments.tournamentGameId} = ${rounds.tournamentGameId})
            or (${operatorAssignments.scopeType} = 'ROUND' and ${operatorAssignments.roundId} = ${matches.roundId})
            or (${operatorAssignments.scopeType} = 'MATCH' and ${operatorAssignments.matchId} = ${matches.id})
            or (${operatorAssignments.scopeType} = 'PARTICIPANT_ENTRY' and ${exists(entryInMatch)})
          )`,
        ),
      ),
  );
}

export async function getOperatorWorkload(
  operatorId: string,
  rawPage?: string,
) {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "SCORE_OPERATOR" || staff.id !== operatorId) {
    throw new StaffAuthorizationError();
  }

  const requestedPage = Number(rawPage);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const db = getDatabase();
  const access = operatorMatchAccessPredicate(operatorId, "VIEW", db);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(access);
  const total = Number(countRow?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  const rows = await db
    .select({
      id: matches.id,
      code: matches.code,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      venue: matches.venue,
      station: matches.station,
      tournamentName: tournaments.name,
      gameName: games.name,
      roundName: rounds.name,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(access)
    .orderBy(desc(matches.scheduledAt), matches.id)
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageCount };
}
