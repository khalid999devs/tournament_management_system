import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
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
  tournaments,
} from "@/db/schema";

export const publicResultsTag = "public-results";

export type PublicMatch = {
  code: string;
  status: string;
  displayScore: string | null;
  scheduledAt: string | null;
  station: string | null;
  entrants: {
    name: string;
    department: string;
    placement: number | null;
    winner: boolean;
  }[];
};

export type PublicGameResults = {
  id: string;
  name: string;
  rounds: { name: string; sequence: number; matches: PublicMatch[] }[];
  podium: { name: string; department: string; placement: number }[];
};

// Only confirmed results are public: live scores stay internal (PRD 11.3),
// so in-progress matches show their competitors but no score.
async function loadPublicResults() {
  const db = getDatabase();
  const [tournament] = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      settings: tournaments.publicSettings,
    })
    .from(tournaments)
    .where(
      sql`${tournaments.status} in ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED')`,
    )
    .orderBy(sql`${tournaments.createdAt} desc`)
    .limit(1);

  if (!tournament?.settings.resultsEnabled)
    return { enabled: false as const, games: [] };

  const gameRows = await db
    .select({
      id: tournamentGames.id,
      name: games.name,
      progressionMode: tournamentGames.progressionMode,
    })
    .from(tournamentGames)
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(
      and(
        eq(tournamentGames.tournamentId, tournament.id),
        sql`${tournamentGames.status} <> 'ARCHIVED'`,
      ),
    )
    .orderBy(asc(tournamentGames.sortOrder), asc(games.name));
  if (gameRows.length === 0) return { enabled: true as const, games: [] };

  const roundRows = await db
    .select({
      id: rounds.id,
      gameId: rounds.tournamentGameId,
      name: rounds.name,
      sequence: rounds.sequence,
    })
    .from(rounds)
    .where(
      inArray(
        rounds.tournamentGameId,
        gameRows.map((game) => game.id),
      ),
    )
    .orderBy(asc(rounds.sequence));
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
          nextMatchId: matches.nextMatchId,
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
  const entrantRows = matchRows.length
    ? await db
        .select({
          matchId: matchEntries.matchId,
          seat: matchEntries.seat,
          placement: matchEntries.placement,
          outcome: matchEntries.outcome,
          name: participants.fullName,
          department: participants.department,
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
            matchRows.map((match) => match.id),
          ),
        )
        .orderBy(asc(matchEntries.seat))
    : [];

  const final = (status: string) =>
    status === "COMPLETED" || status === "WALKOVER";

  const results: PublicGameResults[] = gameRows.map((game) => {
    const gameRounds = roundRows.filter((round) => round.gameId === game.id);
    const roundsOut = gameRounds.map((round) => ({
      name: round.name,
      sequence: round.sequence,
      matches: matchRows
        .filter((match) => match.roundId === round.id)
        .map((match) => ({
          code: match.code,
          status: match.status,
          displayScore: final(match.status) ? match.displayScore : null,
          scheduledAt: match.scheduledAt?.toISOString() ?? null,
          station: match.station,
          entrants: entrantRows
            .filter((entrant) => entrant.matchId === match.id)
            .map((entrant) => ({
              name: entrant.name,
              department: entrant.department,
              placement: final(match.status) ? entrant.placement : null,
              winner: final(match.status) && entrant.outcome === "WIN",
            })),
        })),
    }));

    // Knockout podium: the final's placements. Manual formats publish their
    // match placements only; overall standings need committee rules.
    let podium: PublicGameResults["podium"] = [];
    if (
      game.progressionMode === "AUTOMATIC_SINGLE_ELIMINATION" &&
      gameRounds.length
    ) {
      const lastRound = gameRounds[gameRounds.length - 1];
      const decider = matchRows.find(
        (match) => match.roundId === lastRound.id && !match.nextMatchId,
      );
      if (decider && final(decider.status)) {
        podium = entrantRows
          .filter(
            (entrant) =>
              entrant.matchId === decider.id && entrant.placement !== null,
          )
          .map((entrant) => ({
            name: entrant.name,
            department: entrant.department,
            placement: entrant.placement!,
          }))
          .sort((a, b) => a.placement - b.placement);
      }
    }

    return { id: game.id, name: game.name, rounds: roundsOut, podium };
  });

  return {
    enabled: true as const,
    tournamentName: tournament.name,
    games: results.filter((game) => game.rounds.length),
  };
}

export const getPublicResults = unstable_cache(
  loadPublicResults,
  ["public-results-v2"],
  {
    tags: [publicResultsTag],
    revalidate: 60,
  },
);

export function refreshPublicResults() {
  revalidateTag(publicResultsTag, { expire: 0 });
}
