import { z } from "zod";
import { rankSeats } from "../domain/ranking";
import {
  assertPrevious,
  invalid,
  type CanonicalResult,
  type ScoringAdapter,
  type ScoringContext,
} from "../domain/types";

const seatKey = z.string().regex(/^\d{1,3}$/);
const tiebreakOrder = z
  .array(z.number().int().min(1))
  .max(128)
  .nullable()
  .default(null);

const configSchema = z.object({
  higherWins: z.boolean().default(true),
  targetPoints: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .nullable()
    .default(null),
  allowNegative: z.boolean().default(true),
  allowSharedPlacement: z.boolean().default(false),
});

const scoreSchema = z.object({
  points: z
    .record(seatKey, z.number().int().min(-100000).max(100000))
    .default({}),
  hands: z.number().int().min(0).max(10000).default(0),
  tiebreakOrder,
});

const eventSchema = z.discriminatedUnion("type", [
  // One hand or round: points for any number of players at once.
  z.object({
    type: z.literal("HAND"),
    deltas: z.record(seatKey, z.number().int().min(-10000).max(10000)),
  }),
  z.object({
    type: z.literal("TIEBREAK"),
    order: z.array(z.number().int().min(1)).max(128),
    previous: z.array(z.number().int().min(1)).max(128).nullable(),
  }),
]);

type Config = z.infer<typeof configSchema>;
type Score = z.infer<typeof scoreSchema>;
type Event = z.infer<typeof eventSchema>;

const total = (score: Score, seat: number) => score.points[String(seat)] ?? 0;

function check(score: Score, context: ScoringContext<Config>) {
  for (const key of Object.keys(score.points)) {
    if (!context.seats.includes(Number(key)))
      invalid("Points were recorded for a seat not in this match.");
    if (!context.config.allowNegative && score.points[key] < 0) {
      invalid("Totals cannot go below zero in this game.");
    }
  }
  if (score.tiebreakOrder?.some((seat) => !context.seats.includes(seat))) {
    invalid("The tie-break order lists a seat not in this match.");
  }
}

export const multiplayerPointsAdapter: ScoringAdapter<Config, Score, Event> = {
  key: "MULTIPLAYER_POINTS",
  label: "Multi-player points",
  summary:
    "Points per hand or round for two or more players; placements come from the totals.",
  examples: "29 Cards, Ludo (4 players), Uno, quiz rounds",
  defaultProgression: "MANUAL",
  seats: { min: 2, max: 16 },
  configSchema,
  configFields: [
    {
      kind: "select",
      name: "higherWins",
      label: "Winner",
      options: [
        { value: "true", label: "Highest total wins" },
        { value: "false", label: "Lowest total wins" },
      ],
    },
    {
      kind: "number",
      name: "targetPoints",
      label: "Game ends at",
      help: "Optional. A total reaching this can end the game.",
      min: 1,
      max: 100000,
      optional: true,
    },
    {
      kind: "boolean",
      name: "allowNegative",
      label: "Totals may go below zero",
    },
    {
      kind: "boolean",
      name: "allowSharedPlacement",
      label: "Tied players may share a placement",
      help: "Otherwise the operator must set a tie-break order.",
    },
  ],
  scoreSchema,
  eventSchema,
  emptyScore: () => scoreSchema.parse({}),
  applyEvent(score, event, context, options) {
    if (event.type === "TIEBREAK") {
      assertPrevious(
        score.tiebreakOrder,
        event.previous,
        "The tie-break order",
        options,
      );
      const next = { ...score, tiebreakOrder: event.order };
      check(next, context);
      return next;
    }
    const entries = Object.entries(event.deltas).filter(
      ([, delta]) => delta !== 0,
    );
    if (entries.length === 0) invalid("Enter points for at least one player.");
    const points = { ...score.points };
    for (const [key, delta] of entries) {
      points[key] = (points[key] ?? 0) + delta;
    }
    const next = { ...score, points, hands: score.hands + 1 };
    check(next, context);
    return next;
  },
  validateScore: check,
  finalize(score, context): CanonicalResult {
    check(score, context);
    if (score.hands === 0 && Object.keys(score.points).length === 0) {
      invalid("Record at least one hand before finalizing.");
    }
    const { config } = context;
    if (config.targetPoints !== null) {
      const target = config.targetPoints;
      const reached = context.seats.some(
        (seat) => total(score, seat) >= target,
      );
      if (!reached) {
        invalid(`No player has reached ${config.targetPoints} points yet.`);
      }
    }
    const placements = rankSeats({
      seats: context.seats,
      value: (seat) => total(score, seat),
      higherIsBetter: config.higherWins,
      tiebreakOrder: score.tiebreakOrder,
      allowShared: config.allowSharedPlacement,
      requiresWinner: context.requiresWinner,
      points: (seat) => total(score, seat),
    });
    return {
      placements,
      winnerSeats: placements
        .filter((row) => row.placement === 1)
        .map((row) => row.seat),
      displayScore: display(score, context),
      resultData: {
        points: score.points,
        hands: score.hands,
        tiebreakOrder: score.tiebreakOrder,
      },
    };
  },
  display,
};

// Totals in seat order; screens pair them with names.
function display(score: Score, context: ScoringContext<Config>) {
  return context.seats.map((seat) => total(score, seat)).join(" · ");
}
