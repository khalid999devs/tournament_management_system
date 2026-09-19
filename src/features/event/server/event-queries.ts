import "server-only";

import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import type { Database } from "@/db";
import { getDatabase } from "@/db";
import {
  games,
  paymentMethods,
  registrationGameEntries,
  registrations,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import {
  evaluateReadiness,
  toGameAvailability,
} from "@/features/event/domain/event-settings";

type Executor = Pick<Database, "select">;

// The admin area manages one live tournament at a time: the newest one that
// has not been archived.
export async function findCurrentTournamentId(db: Executor = getDatabase()) {
  const [current] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(ne(tournaments.status, "ARCHIVED"))
    .orderBy(desc(tournaments.createdAt))
    .limit(1);

  return current?.id ?? null;
}

export async function getEventSetup() {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);

  if (!tournamentId) return null;

  const [[tournament], eventGames, methods, [registrationTotal]] =
    await Promise.all([
      db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .limit(1),
      db
        .select({
          id: tournamentGames.id,
          gameId: games.id,
          name: games.name,
          description: games.description,
          feeMinor: tournamentGames.feeMinor,
          capacity: tournamentGames.capacity,
          reservedCount: tournamentGames.reservedCount,
          confirmedCount: tournamentGames.confirmedCount,
          status: tournamentGames.status,
          registrationOpen: tournamentGames.registrationOpen,
          scoringAdapter: tournamentGames.scoringAdapter,
          progressionMode: tournamentGames.progressionMode,
          rules: tournamentGames.rules,
          sortOrder: tournamentGames.sortOrder,
        })
        .from(tournamentGames)
        .innerJoin(games, eq(tournamentGames.gameId, games.id))
        .where(
          and(
            eq(tournamentGames.tournamentId, tournamentId),
            ne(tournamentGames.status, "ARCHIVED"),
          ),
        )
        .orderBy(asc(tournamentGames.sortOrder), asc(games.name)),
      db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.tournamentId, tournamentId))
        .orderBy(
          asc(paymentMethods.sortOrder),
          asc(paymentMethods.displayName),
        ),
      db
        .select({ value: count() })
        .from(registrations)
        .where(eq(registrations.tournamentId, tournamentId)),
    ]);

  const gamesWithAvailability = eventGames.map((game) => ({
    ...game,
    availability: toGameAvailability(game.status, game.registrationOpen),
  }));
  const readiness = evaluateReadiness({
    now: new Date(),
    venue: tournament.venue,
    startsAt: tournament.startsAt,
    endsAt: tournament.endsAt,
    registrationCloseAt: tournament.registrationCloseAt,
    checkInInstructions: tournament.publicSettings.checkInInstructions ?? null,
    games: gamesWithAvailability,
    enabledPaymentMethods: methods.filter((method) => method.enabled).length,
  });

  return {
    tournament,
    games: gamesWithAvailability,
    paymentMethods: methods,
    registrationCount: registrationTotal.value,
    readiness,
  };
}

export async function getTournamentGameDetail(id: string) {
  const db = getDatabase();
  const [game] = await db
    .select({
      id: tournamentGames.id,
      tournamentId: tournamentGames.tournamentId,
      tournamentName: tournaments.name,
      name: games.name,
      description: games.description,
      feeMinor: tournamentGames.feeMinor,
      capacity: tournamentGames.capacity,
      reservedCount: tournamentGames.reservedCount,
      confirmedCount: tournamentGames.confirmedCount,
      status: tournamentGames.status,
      registrationOpen: tournamentGames.registrationOpen,
      scoringAdapter: tournamentGames.scoringAdapter,
      progressionMode: tournamentGames.progressionMode,
      config: tournamentGames.config,
      rules: tournamentGames.rules,
      sortOrder: tournamentGames.sortOrder,
    })
    .from(tournamentGames)
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
    .where(eq(tournamentGames.id, id))
    .limit(1);

  if (!game) return null;

  const [entries] = await db
    .select({ value: count() })
    .from(registrationGameEntries)
    .where(eq(registrationGameEntries.tournamentGameId, id));

  return {
    ...game,
    availability: toGameAvailability(game.status, game.registrationOpen),
    entryCount: entries.value,
  };
}
