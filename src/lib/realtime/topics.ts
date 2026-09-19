// Channel names for live updates. A message only says what changed (ids and
// a version); screens then fetch the data through their usual authorized
// routes, so nothing sensitive travels over Realtime.
export const matchTopic = (matchId: string) => `match:${matchId}`;
export const tournamentTopic = (tournamentId: string) =>
  `tournament:${tournamentId}`;

export const liveEvent = "changed";

export type LiveKind = "match" | "registration" | "issue";

export type LiveMessage = {
  kind: LiveKind | "resync";
  version?: number;
  matchIds?: string[];
};
