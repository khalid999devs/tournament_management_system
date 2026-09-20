import { z } from "zod";
import {
  assertPrevious,
  invalid,
  type CanonicalResult,
  type ScoringAdapter,
  type ScoringContext,
} from "../domain/types";

const seatKey = z.string().regex(/^\d{1,3}$/);

const configSchema = z.object({
  // Points for 1st, 2nd, 3rd…; places beyond the list score zero.
  placementPoints: z
    .array(z.coerce.number().int().min(0).max(1000))
    .min(1)
    .max(100)
    .default([12, 9, 7, 5, 4, 3, 2, 1]),
  pointsPerKill: z.coerce.number().int().min(0).max(100).default(1),
});

const row = z.object({
  finish: z.number().int().min(1).max(999).nullable().default(null),
  kills: z.number().int().min(0).max(999).default(0),
});

const scoreSchema = z.object({
  rows: z.record(seatKey, row).default({}),
});

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("KILL"), seat: z.number().int().min(1) }),
  z.object({
    type: z.literal("FINISH"),
    seat: z.number().int().min(1),
    finish: z.number().int().min(1).max(999).nullable(),
    previous: z.number().int().min(1).max(999).nullable(),
  }),
]);

type Config = z.infer<typeof configSchema>;
type Score = z.infer<typeof scoreSchema>;
type Event = z.infer<typeof eventSchema>;
type Row = z.infer<typeof row>;

const rowFor = (score: Score, seat: number): Row =>
  score.rows[String(seat)] ?? { finish: null, kills: 0 };

function pointsFor(entry: Row, config: Config) {
  const placement =
    entry.finish === null ? 0 : (config.placementPoints[entry.finish - 1] ?? 0);
  return placement + entry.kills * config.pointsPerKill;
}

function check(score: Score, context: ScoringContext<Config>) {
  const finishes = new Map<number, number>();
  for (const [key, entry] of Object.entries(score.rows)) {
    const seat = Number(key);
    if (!context.seats.includes(seat))
      invalid("A result was recorded for a seat not in this match.");
    if (entry.finish !== null) {
      const other = finishes.get(entry.finish);
      if (other !== undefined) {
        invalid(
          `Seats ${other} and ${seat} both finished ${entry.finish}. Each finishing position is unique.`,
        );
      }
      finishes.set(entry.finish, seat);
    }
  }
}

export const placementPointsAdapter: ScoringAdapter<Config, Score, Event> = {
  key: "PLACEMENT_POINTS",
  label: "Placement points",
  summary:
    "Finishing position earns points from a table, plus optional points per elimination.",
  examples: "PUBG Mobile, Free Fire, racing games, battle royale lobbies",
  defaultProgression: "MANUAL",
  seats: { min: 2, max: 100 },
  configSchema,
  configFields: [
    {
      kind: "numberList",
      name: "placementPoints",
      label: "Points by finishing position",
      help: "1st place first, e.g. 12, 9, 7, 5, 4, 3, 2, 1.",
      min: 0,
      max: 1000,
    },
    {
      kind: "number",
      name: "pointsPerKill",
      label: "Points per elimination",
      min: 0,
      max: 100,
    },
  ],
  scoreSchema,
  eventSchema,
  emptyScore: () => ({ rows: {} }),
  applyEvent(score, event, context, options) {
    if (!context.seats.includes(event.seat))
      invalid("Pick a competitor in this match.");
    const current = rowFor(score, event.seat);
    let next: Row;
    if (event.type === "KILL") {
      next = { ...current, kills: current.kills + 1 };
    } else {
      assertPrevious(
        current.finish,
        event.previous,
        `Seat ${event.seat}'s finish`,
        options,
      );
      next = { ...current, finish: event.finish };
    }
    const updated = { rows: { ...score.rows, [String(event.seat)]: next } };
    check(updated, context);
    return updated;
  },
  validateScore: check,
  finalize(score, context): CanonicalResult {
    check(score, context);
    const missing = context.seats.filter(
      (seat) => rowFor(score, seat).finish === null,
    );
    if (missing.length > 0) {
      invalid(`Record the finishing position for seat ${missing.join(", ")}.`);
    }
    const { config } = context;
    // Points decide the order; equal points go to the better finish. Finishes
    // are unique, so there is never an unresolved tie.
    const ordered = [...context.seats].sort(
      (a, b) =>
        pointsFor(rowFor(score, b), config) -
          pointsFor(rowFor(score, a), config) ||
        rowFor(score, a).finish! - rowFor(score, b).finish!,
    );
    const placements = ordered.map((seat, index) => ({
      seat,
      placement: index + 1,
      points: pointsFor(rowFor(score, seat), config),
      outcome: index === 0 ? ("WIN" as const) : ("LOSS" as const),
    }));
    return {
      placements,
      winnerSeats: [ordered[0]],
      displayScore: display(score, context),
      resultData: {
        rows: score.rows,
        placementPoints: config.placementPoints,
        pointsPerKill: config.pointsPerKill,
      },
    };
  },
  display,
};

function display(score: Score, context: ScoringContext<Config>) {
  return context.seats
    .map((seat) => pointsFor(rowFor(score, seat), context.config))
    .join(" · ");
}

export const placementScoring = { pointsFor, rowFor };
