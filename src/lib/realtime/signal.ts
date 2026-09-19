import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { matches, rounds, tournamentGames } from "@/db/schema";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { getServerEnv } from "@/lib/env/server";
import {
  liveEvent,
  matchTopic,
  tournamentTopic,
  type LiveKind,
  type LiveMessage,
} from "./topics";

type Broadcast = {
  topic: string;
  event: string;
  payload: LiveMessage;
  private: true;
};

// Best effort. Screens also refresh on their own, so a lost signal delays an
// update by a few seconds but never loses it. Call through after() so a slow
// Realtime service never holds up a response.
async function broadcast(messages: Broadcast[]) {
  const env = getServerEnv();
  if (!env.SUPABASE_SECRET_KEY || messages.length === 0) return;

  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!response.ok) {
      console.warn("Live update signal not accepted", response.status);
    }
  } catch (error) {
    console.warn("Live update signal failed", (error as Error).name);
  }
}

const message = (topic: string, payload: LiveMessage): Broadcast => ({
  topic,
  event: liveEvent,
  payload,
  private: true,
});

// A match changed: its score screens and the tournament-wide lists hear it.
// includeNext also wakes the next-round match, whose players just changed.
export async function signalMatchChange(
  matchId: string,
  options: { version?: number; includeNext?: boolean; kind?: LiveKind } = {},
) {
  const [row] = await getDatabase()
    .select({
      nextMatchId: matches.nextMatchId,
      tournamentId: tournamentGames.tournamentId,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!row) return;

  const kind = options.kind ?? "match";
  const matchIds = [matchId];
  const messages = [
    message(matchTopic(matchId), { kind, version: options.version }),
  ];
  if (options.includeNext && row.nextMatchId) {
    matchIds.push(row.nextMatchId);
    messages.push(message(matchTopic(row.nextMatchId), { kind }));
  }
  messages.push(message(tournamentTopic(row.tournamentId), { kind, matchIds }));
  await broadcast(messages);
}

// Something tournament-wide changed (a registration, a draw, a report).
export async function signalTournamentChange(
  kind: LiveKind,
  tournamentId?: string | null,
) {
  const id = tournamentId ?? (await findCurrentTournamentId());
  if (id) await broadcast([message(tournamentTopic(id), { kind })]);
}
