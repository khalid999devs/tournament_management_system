import type { ScoringAdapter, ScoringContext } from "../domain/types";
import { carromPointsAdapter } from "./carrom-points";
import { chessOutcomeAdapter } from "./chess-outcome";
import { goalsAdapter } from "./goals";
import { multiplayerPointsAdapter } from "./multiplayer-points";
import { placementPointsAdapter } from "./placement-points";
import { scoreCompareAdapter } from "./score-compare";
import { setsAdapter } from "./sets";

// Adapters are pure and run in the browser (instant feedback) and on the
// server (authority). Adding a game type means adding one file here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScoringAdapter = ScoringAdapter<any, any, any>;

export const scoringAdapterList = [
  chessOutcomeAdapter,
  goalsAdapter,
  setsAdapter,
  carromPointsAdapter,
  multiplayerPointsAdapter,
  scoreCompareAdapter,
  placementPointsAdapter,
] as const satisfies readonly AnyScoringAdapter[];

export type ScoringAdapterKey = (typeof scoringAdapterList)[number]["key"];

export const scoringAdapterKeys = scoringAdapterList.map(
  (adapter) => adapter.key,
) as [ScoringAdapterKey, ...ScoringAdapterKey[]];

export function isScoringAdapterKey(key: string): key is ScoringAdapterKey {
  return (scoringAdapterKeys as string[]).includes(key);
}

export function getScoringAdapter(key: string): AnyScoringAdapter {
  const adapter = scoringAdapterList.find((item) => item.key === key);
  if (!adapter) throw new Error(`Unknown scoring adapter ${key}`);
  return adapter;
}

// Stored settings may predate a new option; parsing fills in defaults.
export function parseScoringConfig(key: string, raw: unknown): unknown {
  return getScoringAdapter(key).configSchema.parse(raw ?? {});
}

export function buildScoringContext(input: {
  adapterKey: string;
  config: unknown;
  seats: number[];
  progressionMode: string;
}): ScoringContext<unknown> {
  return {
    config: parseScoringConfig(input.adapterKey, input.config),
    seats: [...input.seats].sort((a, b) => a - b),
    requiresWinner: input.progressionMode === "AUTOMATIC_SINGLE_ELIMINATION",
  };
}
