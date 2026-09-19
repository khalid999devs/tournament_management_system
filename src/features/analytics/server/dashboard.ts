import "server-only";

import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  games,
  matches,
  matchUpdates,
  notifications,
  operatorAssignments,
  payments,
  registrationGameEntries,
  registrations,
  rounds,
  staffProfiles,
  tournamentGames,
} from "@/db/schema";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import {
  countOpenIssues,
  listOpenIssues,
} from "@/features/issues/server/issues";

const recentWindowMinutes = 30;

// Every figure is counted from the database on each request for the
// tournament being managed; nothing is cached or estimated.
export async function getDashboard() {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  if (!tournamentId) return null;

  const since = new Date(Date.now() - recentWindowMinutes * 60_000);
  const inTournament = eq(tournamentGames.tournamentId, tournamentId);

  const [
    registrationRows,
    feeRows,
    [entries],
    matchRows,
    [staff],
    [scoringNow],
    openIssueCount,
    openIssues,
    recentUpdates,
    deliveryRows,
  ] = await Promise.all([
    db
      .select({ status: registrations.status, value: count() })
      .from(registrations)
      .where(eq(registrations.tournamentId, tournamentId))
      .groupBy(registrations.status),
    db
      .select({
        status: registrations.status,
        total: sql<number>`coalesce(sum(${payments.expectedAmountMinor}), 0)::int`,
      })
      .from(registrations)
      .innerJoin(payments, eq(payments.registrationId, registrations.id))
      .where(eq(registrations.tournamentId, tournamentId))
      .groupBy(registrations.status),
    db
      .select({ value: count() })
      .from(registrationGameEntries)
      .innerJoin(
        tournamentGames,
        eq(registrationGameEntries.tournamentGameId, tournamentGames.id),
      )
      .where(
        and(inTournament, eq(registrationGameEntries.status, "CONFIRMED")),
      ),
    db
      .select({ status: matches.status, value: count() })
      .from(matches)
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .innerJoin(
        tournamentGames,
        eq(rounds.tournamentGameId, tournamentGames.id),
      )
      .where(inTournament)
      .groupBy(matches.status),
    db
      .select({
        operators: sql<number>`count(distinct ${operatorAssignments.operatorId})::int`,
        assignments: sql<number>`count(*)::int`,
      })
      .from(operatorAssignments)
      .innerJoin(
        staffProfiles,
        eq(operatorAssignments.operatorId, staffProfiles.id),
      )
      .where(
        and(
          eq(operatorAssignments.tournamentId, tournamentId),
          eq(operatorAssignments.active, true),
          eq(staffProfiles.active, true),
        ),
      ),
    db
      .select({
        value: sql<number>`count(distinct ${matchUpdates.actorStaffId})::int`,
      })
      .from(matchUpdates)
      .innerJoin(matches, eq(matchUpdates.matchId, matches.id))
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .innerJoin(
        tournamentGames,
        eq(rounds.tournamentGameId, tournamentGames.id),
      )
      .where(and(inTournament, gt(matchUpdates.createdAt, since))),
    countOpenIssues(tournamentId),
    listOpenIssues(tournamentId, 5),
    db
      .select({
        id: matchUpdates.id,
        type: matchUpdates.updateType,
        createdAt: matchUpdates.createdAt,
        actorName: staffProfiles.displayName,
        matchId: matches.id,
        matchCode: matches.code,
        gameName: games.name,
        displayScore: matches.displayScore,
      })
      .from(matchUpdates)
      .innerJoin(staffProfiles, eq(matchUpdates.actorStaffId, staffProfiles.id))
      .innerJoin(matches, eq(matchUpdates.matchId, matches.id))
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .innerJoin(
        tournamentGames,
        eq(rounds.tournamentGameId, tournamentGames.id),
      )
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .where(inTournament)
      .orderBy(desc(matchUpdates.createdAt), desc(matchUpdates.id))
      .limit(8),
    db
      .select({ status: notifications.status, value: count() })
      .from(notifications)
      .where(inArray(notifications.status, ["QUEUED", "SENDING", "FAILED"]))
      .groupBy(notifications.status),
  ]);

  const byStatus = <T extends string>(
    rows: { status: T; value: number }[],
    status: T,
  ) => Number(rows.find((row) => row.status === status)?.value ?? 0);
  const feeFor = (status: string) =>
    Number(feeRows.find((row) => row.status === status)?.total ?? 0);

  return {
    generatedAt: new Date(),
    registrations: {
      pending: byStatus(registrationRows, "PENDING_REVIEW"),
      confirmed: byStatus(registrationRows, "CONFIRMED"),
      rejected: byStatus(registrationRows, "REJECTED"),
      total: registrationRows.reduce((sum, row) => sum + Number(row.value), 0),
    },
    fees: {
      verifiedMinor: feeFor("CONFIRMED"),
      awaitingMinor: feeFor("PENDING_REVIEW"),
    },
    confirmedEntries: Number(entries?.value ?? 0),
    matches: {
      live: byStatus(matchRows, "IN_PROGRESS"),
      scheduled: byStatus(matchRows, "SCHEDULED"),
      finished:
        byStatus(matchRows, "COMPLETED") + byStatus(matchRows, "WALKOVER"),
      held: byStatus(matchRows, "POSTPONED") + byStatus(matchRows, "CANCELLED"),
      total: matchRows.reduce((sum, row) => sum + Number(row.value), 0),
    },
    staff: {
      operators: Number(staff?.operators ?? 0),
      assignments: Number(staff?.assignments ?? 0),
      scoringNow: Number(scoringNow?.value ?? 0),
      windowMinutes: recentWindowMinutes,
    },
    issues: { open: openIssueCount, latest: openIssues },
    recentUpdates,
    delivery: {
      waiting:
        byStatus(deliveryRows, "QUEUED") + byStatus(deliveryRows, "SENDING"),
      failed: byStatus(deliveryRows, "FAILED"),
    },
  };
}

export type Dashboard = NonNullable<Awaited<ReturnType<typeof getDashboard>>>;
