import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
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
  RegistrationGameOption,
  RegistrationPaymentMethod,
  RegistrationTournament,
} from "@/features/registration/domain/types";

export const publicEventTag = "public-event";

const publicQueryTimeoutMs = 8000;

export type PublicEvent = {
  id: string;
  name: string;
  venue: string | null;
  status:
    "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "IN_PROGRESS" | "COMPLETED";
  startsAt: string | null;
  endsAt: string | null;
  registrationCloseAt: string | null;
  maxGamesPerParticipant: number;
  games: (RegistrationGameOption & { status: string })[];
  paymentMethods: RegistrationPaymentMethod[];
};

const visibleStatuses = [
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

async function loadPublicEvent(): Promise<PublicEvent | null> {
  const db = getDatabase();
  const [tournament] = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      venue: tournaments.venue,
      status: tournaments.status,
      startsAt: tournaments.startsAt,
      endsAt: tournaments.endsAt,
      registrationCloseAt: tournaments.registrationCloseAt,
      maxGamesPerParticipant: tournaments.maxGamesPerParticipant,
    })
    .from(tournaments)
    .where(inArray(tournaments.status, [...visibleStatuses]))
    .orderBy(desc(tournaments.registrationOpenAt))
    .limit(1);

  if (!tournament) return null;

  const [eventGames, methods] = await Promise.all([
    db
      .select({
        id: tournamentGames.id,
        name: games.name,
        description: games.description,
        feeMinor: tournamentGames.feeMinor,
        capacity: tournamentGames.capacity,
        reservedCount: tournamentGames.reservedCount,
        confirmedCount: tournamentGames.confirmedCount,
        registrationOpen: tournamentGames.registrationOpen,
        status: tournamentGames.status,
      })
      .from(tournamentGames)
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .where(
        and(
          eq(tournamentGames.tournamentId, tournament.id),
          inArray(tournamentGames.status, [
            "REGISTRATION_OPEN",
            "REGISTRATION_CLOSED",
            "ACTIVE",
            "COMPLETED",
          ]),
          eq(games.active, true),
        ),
      )
      .orderBy(tournamentGames.sortOrder, games.name),
    db
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
      .orderBy(paymentMethods.sortOrder, paymentMethods.displayName),
  ]);

  return {
    ...tournament,
    status: tournament.status as PublicEvent["status"],
    startsAt: tournament.startsAt?.toISOString() ?? null,
    endsAt: tournament.endsAt?.toISOString() ?? null,
    registrationCloseAt: tournament.registrationCloseAt?.toISOString() ?? null,
    games: eventGames.map((game) => ({
      ...game,
      description: game.description ?? "Tournament game",
    })),
    paymentMethods: methods,
  };
}

function withTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("PUBLIC_EVENT_TIMEOUT")),
      publicQueryTimeoutMs,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

// Event configuration changes rarely. Public pages share one cached copy and
// staff mutations refresh it; capacity is re-checked inside the submit
// transaction, so a briefly stale slot count can never oversubscribe a game.
const getCachedPublicEvent = unstable_cache(
  () => withTimeout(loadPublicEvent()),
  ["public-event-v1"],
  { tags: [publicEventTag], revalidate: 60 },
);

export const getPublicEvent = cache(getCachedPublicEvent);

export function refreshPublicEvent() {
  revalidateTag(publicEventTag, { expire: 0 });
}

export async function getRegistrationTournament(): Promise<RegistrationTournament | null> {
  const event = await getPublicEvent();

  if (!event || event.status !== "REGISTRATION_OPEN") return null;

  const openGames = event.games
    .filter(
      (game) => game.status === "REGISTRATION_OPEN" && game.registrationOpen,
    )
    .map((game) => ({
      id: game.id,
      name: game.name,
      description: game.description,
      feeMinor: game.feeMinor,
      capacity: game.capacity,
      reservedCount: game.reservedCount,
      confirmedCount: game.confirmedCount,
      registrationOpen: game.registrationOpen,
    }));

  if (openGames.length === 0) return null;

  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    maxGamesPerParticipant: event.maxGamesPerParticipant,
    games: openGames,
  };
}

export async function getRegistrationCheckout(): Promise<RegistrationCheckout | null> {
  const [tournament, event] = await Promise.all([
    getRegistrationTournament(),
    getPublicEvent(),
  ]);

  if (!tournament || !event) return null;

  return { ...tournament, paymentMethods: event.paymentMethods };
}
