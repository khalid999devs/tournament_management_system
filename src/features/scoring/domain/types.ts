import type { z } from "zod";

export type MatchOutcome = "WIN" | "LOSS" | "DRAW" | "DQ" | "DNS";

export type Placement = {
  seat: number;
  placement: number;
  points?: number;
  outcome: MatchOutcome;
};

// The canonical result every adapter produces (PRD 10.4). Seats refer to
// match_entries.seat; the server maps them to entry ids.
export type CanonicalResult = {
  placements: Placement[];
  winnerSeats: number[];
  displayScore: string;
  resultData: Record<string, unknown>;
};

export type ScoringContext<Config> = {
  config: Config;
  // Seats that hold a competitor, in seat order.
  seats: number[];
  // Automatic elimination needs exactly one winner to advance.
  requiresWinner: boolean;
};

export type ApplyOptions = {
  // During a replay (after an event is voided) per-field "previous value"
  // checks are skipped: they guarded the original submission only.
  replay?: boolean;
};

export type ConfigField =
  | {
      kind: "number";
      name: string;
      label: string;
      help?: string;
      min: number;
      max: number;
      optional?: boolean;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      help?: string;
      options: { value: string; label: string }[];
    }
  | { kind: "boolean"; name: string; label: string; help?: string }
  | {
      kind: "text";
      name: string;
      label: string;
      help?: string;
      maxLength: number;
    }
  | {
      kind: "numberList";
      name: string;
      label: string;
      help?: string;
      min: number;
      max: number;
    };

export type ScoringAdapter<Config, Score, Event> = {
  key: string;
  label: string;
  summary: string;
  examples: string;
  defaultProgression: "AUTOMATIC_SINGLE_ELIMINATION" | "MANUAL";
  seats: { min: number; max: number };
  configSchema: z.ZodType<Config>;
  configFields: ConfigField[];
  scoreSchema: z.ZodType<Score>;
  // Null when the game has no live increments (e.g. chess records only an outcome).
  eventSchema: z.ZodType<Event> | null;
  emptyScore(context: ScoringContext<Config>): Score;
  applyEvent(
    score: Score,
    event: Event,
    context: ScoringContext<Config>,
    options?: ApplyOptions,
  ): Score;
  // Structural check for a typed-in score; incomplete scores are allowed.
  validateScore(score: Score, context: ScoringContext<Config>): void;
  finalize(score: Score, context: ScoringContext<Config>): CanonicalResult;
  display(score: Score, context: ScoringContext<Config>): string;
};

export class ScoringError extends Error {
  constructor(
    readonly code: "INVALID_SCORE" | "STALE_MATCH_VERSION",
    message: string,
  ) {
    super(message);
    this.name = "ScoringError";
  }
}

export function invalid(message: string): never {
  throw new ScoringError("INVALID_SCORE", message);
}

// Events that overwrite one field (a typed value, a finishing position, a
// tie-break order) carry the value the operator saw. If another operator
// changed that field first, the event is refused rather than silently
// replacing their entry. Replays skip the check.
export function assertPrevious(
  current: unknown,
  previous: unknown,
  label: string,
  options?: ApplyOptions,
) {
  if (options?.replay) return;
  if (JSON.stringify(current ?? null) !== JSON.stringify(previous ?? null)) {
    throw new ScoringError(
      "STALE_MATCH_VERSION",
      `${label} was just changed by someone else. Check the new value and try again.`,
    );
  }
}
