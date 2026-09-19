import "server-only";

import {
  and,
  eq,
  exists,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDatabase, type Database } from "@/db";
import {
  games,
  matchEntries,
  matches,
  operatorAssignments,
  participants,
  registrationGameEntries,
  registrations,
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
  db: Pick<Database, "select"> = getDatabase(),
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

export type WorkloadFilter = "open" | "done" | "all";

const finished = ["COMPLETED", "WALKOVER", "CANCELLED"] as const;

export async function getOperatorWorkload(
  operatorId: string,
  options: { page?: string; status?: string; q?: string } = {},
) {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== "SCORE_OPERATOR" || staff.id !== operatorId) {
    throw new StaffAuthorizationError();
  }

  const requestedPage = Number(options.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const filter: WorkloadFilter =
    options.status === "done" || options.status === "all"
      ? options.status
      : "open";
  const search = options.q?.trim().slice(0, 80) ?? "";

  const db = getDatabase();
  const conditions: SQL[] = [
    operatorMatchAccessPredicate(operatorId, "VIEW", db),
  ];
  if (filter === "open")
    conditions.push(notInArray(matches.status, [...finished]));
  if (filter === "done")
    conditions.push(inArray(matches.status, [...finished]));
  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
    const entrantMatches = db
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
    conditions.push(or(ilike(matches.code, pattern), exists(entrantMatches))!);
  }
  const where = and(...conditions);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(where);
  const total = Number(countRow?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  // Live matches first, then the next scheduled ones.
  const rows = await db
    .select({
      id: matches.id,
      code: matches.code,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      venue: matches.venue,
      station: matches.station,
      displayScore: matches.displayScore,
      tournamentName: tournaments.name,
      gameName: games.name,
      roundName: rounds.name,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(where)
    .orderBy(
      sql`case ${matches.status} when 'IN_PROGRESS' then 0 when 'SCHEDULED' then 1 when 'POSTPONED' then 2 else 3 end`,
      sql`${matches.scheduledAt} asc nulls last`,
      rounds.sequence,
      matches.code,
      matches.id,
    )
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  const names = rows.length
    ? await db
        .select({
          matchId: matchEntries.matchId,
          seat: matchEntries.seat,
          name: participants.fullName,
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
        .innerJoin(
          participants,
          eq(registrations.participantId, participants.id),
        )
        .where(
          inArray(
            matchEntries.matchId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(matchEntries.seat)
    : [];

  return {
    rows: rows.map((row) => ({
      ...row,
      entrants: names
        .filter((item) => item.matchId === row.id)
        .map((item) => item.name),
    })),
    total,
    page: currentPage,
    pageCount,
    filter,
    search,
  };
}
