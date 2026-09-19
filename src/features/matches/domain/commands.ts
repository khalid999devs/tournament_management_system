import { z } from "zod";
import type { AnyScoringAdapter } from "@/features/scoring/adapters";
import type { ScoringContext } from "@/features/scoring/domain/types";

export type MatchStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "WALKOVER"
  | "POSTPONED"
  | "CANCELLED";

export const finishedStatuses: MatchStatus[] = [
  "COMPLETED",
  "WALKOVER",
  "CANCELLED",
];
export const playableStatuses: MatchStatus[] = ["SCHEDULED", "IN_PROGRESS"];

const version = z.number().int().min(1);

// Commands an operator (or admin) sends from the score screen. Each one is
// wrapped in an envelope with a client-generated id so a retry after a lost
// response is applied once.
export const scoreCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START") }),
  // A delta such as a goal or a point. Deltas from different operators never
  // conflict, so they carry no expected version.
  z.object({ type: z.literal("EVENT"), event: z.unknown() }),
  // Undo one earlier delta; the voided row stays in the history.
  z.object({ type: z.literal("VOID"), updateId: z.uuid() }),
  // Commands that replace state carry the version the operator saw.
  z.object({
    type: z.literal("SET_SCORE"),
    expectedVersion: version,
    score: z.unknown(),
  }),
  z.object({
    type: z.literal("FINALIZE"),
    expectedVersion: version,
    score: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("WALKOVER"),
    expectedVersion: version,
    absentSeats: z.array(z.number().int().min(1)).max(128),
    note: z.string().trim().max(300).optional(),
  }),
]);

export type ScoreCommand = z.infer<typeof scoreCommandSchema>;

export const commandEnvelopeSchema = z.object({
  clientEventId: z.uuid(),
  // When the operator pressed the button, from their device clock.
  deviceTime: z.iso.datetime({ offset: true }).nullable().optional(),
  command: scoreCommandSchema,
});

export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;

export const updateTypes = {
  STARTED: "STARTED",
  SCORE_EVENT: "SCORE_EVENT",
  SCORE_VOIDED: "SCORE_VOIDED",
  SCORE_SET: "SCORE_SET",
  FINALIZED: "FINALIZED",
  WALKOVER: "WALKOVER",
  REOPENED: "REOPENED",
  POSTPONED: "POSTPONED",
  RESUMED: "RESUMED",
  CANCELLED: "CANCELLED",
  ENTRANT_ADVANCED: "ENTRANT_ADVANCED",
  ENTRANT_WITHDRAWN: "ENTRANT_WITHDRAWN",
} as const;

const updateLabels: Record<string, string> = {
  STARTED: "Match started",
  SCORE_EVENT: "Score entered",
  SCORE_VOIDED: "Score undone",
  SCORE_SET: "Score typed in",
  FINALIZED: "Result confirmed",
  WALKOVER: "Walkover recorded",
  REOPENED: "Result reopened",
  POSTPONED: "Match postponed",
  RESUMED: "Match resumed",
  CANCELLED: "Match cancelled",
  ENTRANT_ADVANCED: "Winner moved in",
  ENTRANT_WITHDRAWN: "Winner withdrawn",
};

export function describeUpdateType(type: string) {
  return updateLabels[type] ?? "Update";
}

export type LoggedUpdate = {
  id: string;
  updateType: string;
  payload: Record<string, unknown>;
};

// Rebuilds the live score from the log: deltas apply in sequence order,
// typed scores replace the state, voided deltas are skipped. Used after an
// undo, when the stored score can no longer be adjusted incrementally.
export function replayScore(
  adapter: AnyScoringAdapter,
  context: ScoringContext<unknown>,
  updates: LoggedUpdate[],
) {
  const voided = new Set(
    updates
      .filter((update) => update.updateType === updateTypes.SCORE_VOIDED)
      .map((update) => String(update.payload.updateId)),
  );

  let score = adapter.emptyScore(context);
  for (const update of updates) {
    if (
      update.updateType === updateTypes.SCORE_EVENT &&
      !voided.has(update.id)
    ) {
      score = adapter.applyEvent(score, update.payload.event, context, {
        replay: true,
      });
    } else if (
      (update.updateType === updateTypes.SCORE_SET ||
        update.updateType === updateTypes.FINALIZED) &&
      update.payload.score !== undefined
    ) {
      score = adapter.scoreSchema.parse(update.payload.score);
    }
  }
  return score;
}

export function describeStatus(status: MatchStatus) {
  return {
    SCHEDULED: "Scheduled",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    WALKOVER: "Walkover",
    POSTPONED: "Postponed",
    CANCELLED: "Cancelled",
  }[status];
}
