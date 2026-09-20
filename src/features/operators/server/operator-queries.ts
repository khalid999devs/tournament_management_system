import "server-only";

import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  games,
  matches,
  notifications,
  operatorAssignments,
  participants,
  registrationGameEntries,
  registrations,
  rounds,
  staffProfiles,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import { requireSuperAdmin } from "@/features/auth/server/staff-session";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";

/**
 * The operator directory, with the games each one already covers so the list
 * page can hand out a whole game in one click.
 */
export async function getOperators() {
  await requireSuperAdmin();
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);

  const [people, gameRows, assignmentRows] = await Promise.all([
    db
      .select({
        id: staffProfiles.id,
        email: staffProfiles.email,
        displayName: staffProfiles.displayName,
        active: staffProfiles.active,
      })
      .from(staffProfiles)
      .where(eq(staffProfiles.role, "SCORE_OPERATOR"))
      .orderBy(desc(staffProfiles.active), asc(staffProfiles.displayName)),
    tournamentId
      ? db
          .select({ id: tournamentGames.id, name: games.name })
          .from(tournamentGames)
          .innerJoin(games, eq(tournamentGames.gameId, games.id))
          .where(eq(tournamentGames.tournamentId, tournamentId))
          .orderBy(asc(games.name))
      : Promise.resolve([]),
    tournamentId
      ? db
          .select({
            operatorId: operatorAssignments.operatorId,
            scopeType: operatorAssignments.scopeType,
            tournamentGameId: operatorAssignments.tournamentGameId,
          })
          .from(operatorAssignments)
          .where(
            and(
              eq(operatorAssignments.tournamentId, tournamentId),
              eq(operatorAssignments.active, true),
            ),
          )
      : Promise.resolve([]),
  ]);

  const operators = people.map((person) => {
    const held = assignmentRows.filter((row) => row.operatorId === person.id);
    return {
      ...person,
      coversEverything: held.some((row) => row.scopeType === "ALL_TOURNAMENT"),
      gameIds: held
        .filter((row) => row.scopeType === "GAME" && row.tournamentGameId)
        .map((row) => row.tournamentGameId as string),
      otherScopes: held.filter(
        (row) => row.scopeType !== "ALL_TOURNAMENT" && row.scopeType !== "GAME",
      ).length,
    };
  });

  return { tournamentId, games: gameRows, operators };
}

export async function getOperatorDetail(operatorId: string) {
  await requireSuperAdmin();
  const db = getDatabase();
  const [profile] = await db
    .select({
      id: staffProfiles.id,
      email: staffProfiles.email,
      displayName: staffProfiles.displayName,
      active: staffProfiles.active,
    })
    .from(staffProfiles)
    .where(
      and(
        eq(staffProfiles.id, operatorId),
        eq(staffProfiles.role, "SCORE_OPERATOR"),
      ),
    )
    .limit(1);

  if (!profile) return null;

  const [
    assignments,
    invitations,
    tournamentOptions,
    gameOptions,
    roundOptions,
    matchOptions,
  ] = await Promise.all([
    db
      .select({
        id: operatorAssignments.id,
        scopeType: operatorAssignments.scopeType,
        tournamentId: operatorAssignments.tournamentId,
        tournamentGameId: operatorAssignments.tournamentGameId,
        roundId: operatorAssignments.roundId,
        matchId: operatorAssignments.matchId,
        registrationGameEntryId: operatorAssignments.registrationGameEntryId,
        capabilities: operatorAssignments.capabilities,
        createdAt: operatorAssignments.createdAt,
      })
      .from(operatorAssignments)
      // Removed access is history, kept in the audit log rather than on the
      // page, so an admin reads only what this operator can reach today.
      .where(
        and(
          eq(operatorAssignments.operatorId, operatorId),
          eq(operatorAssignments.active, true),
        ),
      )
      .orderBy(desc(operatorAssignments.createdAt)),
    db
      .select({
        id: notifications.id,
        status: notifications.status,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.staffProfileId, operatorId))
      .orderBy(desc(notifications.createdAt))
      .limit(1),
    db
      .select({ id: tournaments.id, label: tournaments.name })
      .from(tournaments)
      .orderBy(desc(tournaments.year), tournaments.name),
    db
      .select({
        id: tournamentGames.id,
        tournamentId: tournamentGames.tournamentId,
        tournamentName: tournaments.name,
        label: games.name,
      })
      .from(tournamentGames)
      .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .orderBy(desc(tournaments.year), games.name),
    db
      .select({
        id: rounds.id,
        tournamentId: tournamentGames.tournamentId,
        tournamentName: tournaments.name,
        gameName: games.name,
        label: rounds.name,
      })
      .from(rounds)
      .innerJoin(
        tournamentGames,
        eq(rounds.tournamentGameId, tournamentGames.id),
      )
      .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .orderBy(desc(tournaments.year), games.name, rounds.sequence),
    db
      .select({
        id: matches.id,
        tournamentId: tournamentGames.tournamentId,
        tournamentName: tournaments.name,
        gameName: games.name,
        roundName: rounds.name,
        label: matches.code,
      })
      .from(matches)
      .innerJoin(rounds, eq(matches.roundId, rounds.id))
      .innerJoin(
        tournamentGames,
        eq(rounds.tournamentGameId, tournamentGames.id),
      )
      .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .orderBy(
        desc(tournaments.year),
        games.name,
        rounds.sequence,
        matches.code,
      ),
  ]);

  return {
    profile,
    assignments,
    invitation: invitations[0] ?? null,
    options: {
      tournaments: tournamentOptions,
      games: gameOptions,
      rounds: roundOptions,
      matches: matchOptions,
      // Players are not shipped with the page. An event can hold hundreds, so
      // the picker fetches them on demand and only the assigned ones are
      // named here.
      entries: await entryLabels(
        assignments
          .map((assignment) => assignment.registrationGameEntryId)
          .filter((id): id is string => id !== null),
      ),
    },
  };
}

/** Names for the handful of players an operator is already assigned to. */
async function entryLabels(ids: string[]) {
  if (ids.length === 0) return [];
  return entrySelect().where(inArray(registrationGameEntries.id, ids));
}

/** Players an admin can be given, narrowed by a search and always capped. */
/**
 * Players an admin can be given, one row per person rather than one per game
 * they entered. Choosing a player covers every game they are in.
 */
export async function searchParticipantEntries(query: string) {
  await requireSuperAdmin();
  const term = query.trim();
  const like = `%${term.replace(/[%_]/g, (match) => `\\${match}`)}%`;

  const rows = await entrySelect()
    .where(
      term.length === 0
        ? undefined
        : or(
            ilike(participants.fullName, like),
            ilike(registrations.code, like),
            ilike(participants.normalizedStudentId, like),
            ilike(games.name, like),
          ),
    )
    .orderBy(asc(participants.fullName), asc(games.name))
    .limit(200);

  const players = new Map<
    string,
    {
      participantId: string;
      label: string;
      studentId: string;
      registrationCode: string;
      games: string[];
      entries: { id: string; tournamentId: string }[];
    }
  >();

  for (const row of rows) {
    const player = players.get(row.participantId) ?? {
      participantId: row.participantId,
      label: row.label,
      studentId: row.studentId,
      registrationCode: row.registrationCode,
      games: [],
      entries: [],
    };
    player.games.push(row.gameName);
    player.entries.push({ id: row.id, tournamentId: row.tournamentId });
    players.set(row.participantId, player);
  }

  return [...players.values()].slice(0, 40);
}

function entrySelect() {
  return getDatabase()
    .select({
      id: registrationGameEntries.id,
      participantId: participants.id,
      tournamentId: tournamentGames.tournamentId,
      gameName: games.name,
      label: participants.fullName,
      studentId: participants.normalizedStudentId,
      registrationCode: registrations.code,
    })
    .from(registrationGameEntries)
    .innerJoin(
      registrations,
      eq(registrationGameEntries.registrationId, registrations.id),
    )
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .innerJoin(
      tournamentGames,
      eq(registrationGameEntries.tournamentGameId, tournamentGames.id),
    )
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .$dynamic();
}
