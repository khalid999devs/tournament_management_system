import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDatabase } from "@/db";
import {
  games,
  paymentMethods,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import type {
  RegistrationCheckout,
  RegistrationTournament,
} from "@/features/registration/domain/types";

export const getRegistrationTournament = cache(
  async (): Promise<RegistrationTournament | null> => {
    const db = getDatabase();
    const [tournament] = await db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        venue: tournaments.venue,
        maxGamesPerParticipant: tournaments.maxGamesPerParticipant,
      })
      .from(tournaments)
      .where(eq(tournaments.status, "REGISTRATION_OPEN"))
      .orderBy(desc(tournaments.registrationOpenAt))
      .limit(1);

    if (!tournament) return null;

    const availableGames = await db
      .select({
        id: tournamentGames.id,
        name: games.name,
        description: games.description,
        feeMinor: tournamentGames.feeMinor,
        capacity: tournamentGames.capacity,
        reservedCount: tournamentGames.reservedCount,
        confirmedCount: tournamentGames.confirmedCount,
        registrationOpen: tournamentGames.registrationOpen,
      })
      .from(tournamentGames)
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .where(
        and(
          eq(tournamentGames.tournamentId, tournament.id),
          eq(tournamentGames.status, "REGISTRATION_OPEN"),
          eq(tournamentGames.registrationOpen, true),
          eq(games.active, true),
        ),
      )
      .orderBy(tournamentGames.sortOrder, games.name);

    if (availableGames.length === 0) return null;

    return {
      ...tournament,
      games: availableGames.map((game) => ({
        ...game,
        description: game.description ?? "Tournament game",
      })),
    };
  },
);

export async function getRegistrationCheckout(): Promise<RegistrationCheckout | null> {
  const tournament = await getRegistrationTournament();

  if (!tournament) return null;

  const methods = await getDatabase()
    .select({
      provider: paymentMethods.provider,
      displayName: paymentMethods.displayName,
      receivingAccount: paymentMethods.receivingAccount,
      instructions: paymentMethods.instructions,
    })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.tournamentId, tournament.id),
        eq(paymentMethods.enabled, true),
      ),
    )
    .orderBy(paymentMethods.sortOrder, paymentMethods.displayName);

  return { ...tournament, paymentMethods: methods };
}
