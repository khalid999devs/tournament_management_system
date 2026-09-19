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
const value = z.number().min(-1_000_000).max(1_000_000);

const configSchema = z.object({
  direction: z.enum(["HIGHER", "LOWER"]).default("HIGHER"),
  decimals: z.coerce.number().int().min(0).max(3).default(0),
  unit: z.string().trim().max(20).default("points"),
  allowSharedPlacement: z.boolean().default(false),
});

const scoreSchema = z.object({
  values: z.record(seatKey, value).default({}),
  tiebreakOrder: z
    .array(z.number().int().min(1))
    .max(128)
    .nullable()
    .default(null),
});

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("VALUE"),
    seat: z.number().int().min(1),
    value: value.nullable(),
    previous: value.nullable(),
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

const read = (score: Score, seat: number) => score.values[String(seat)] ?? null;

function check(score: Score, context: ScoringContext<Config>) {
  const factor = 10 ** context.config.decimals;
  for (const [key, entry] of Object.entries(score.values)) {
    if (!context.seats.includes(Number(key)))
      invalid("A value was recorded for a seat not in this match.");
    if (Math.abs(Math.round(entry * factor) - entry * factor) > 1e-6) {
      invalid(`Use at most ${context.config.decimals} decimal places.`);
    }
  }
  if (score.tiebreakOrder?.some((seat) => !context.seats.includes(seat))) {
    invalid("The tie-break order lists a seat not in this match.");
  }
}

export const scoreCompareAdapter: ScoringAdapter<Config, Score, Event> = {
  key: "SCORE_COMPARE",
  label: "Highest or lowest score wins",
  summary:
    "One final number per competitor (points, time or distance), ranked highest-first or lowest-first.",
  examples: "Scrabble, Rubik's cube time trials, typing speed, quiz totals",
  defaultProgression: "AUTOMATIC_SINGLE_ELIMINATION",
  seats: { min: 2, max: 64 },
  configSchema,
  configFields: [
    {
      kind: "select",
      name: "direction",
      label: "Winner",
      options: [
        { value: "HIGHER", label: "Highest value wins" },
        { value: "LOWER", label: "Lowest value wins (times)" },
      ],
    },
    {
      kind: "number",
      name: "decimals",
      label: "Decimal places",
      min: 0,
      max: 3,
    },
    {
      kind: "text",
      name: "unit",
      label: "Unit shown",
      help: "e.g. points, seconds, words/min",
      maxLength: 20,
    },
    {
      kind: "boolean",
      name: "allowSharedPlacement",
      label: "Tied competitors may share a placement",
      help: "Otherwise the operator must set a tie-break order. Knockout games always need one winner.",
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
    if (!context.seats.includes(event.seat))
      invalid("Pick a competitor in this match.");
    assertPrevious(
      read(score, event.seat),
      event.previous,
      `Seat ${event.seat}'s value`,
      options,
    );
    const values = { ...score.values };
    if (event.value === null) delete values[String(event.seat)];
    else values[String(event.seat)] = event.value;
    const next = { ...score, values };
    check(next, context);
    return next;
  },
  validateScore: check,
  finalize(score, context): CanonicalResult {
    check(score, context);
    const missing = context.seats.filter((seat) => read(score, seat) === null);
    if (missing.length > 0) {
      invalid(
        `Enter a value for seat ${missing.join(", ")} before finalizing.`,
      );
    }
    const factor = 10 ** context.config.decimals;
    const placements = rankSeats({
      seats: context.seats,
      value: (seat) => read(score, seat)!,
      higherIsBetter: context.config.direction === "HIGHER",
      tiebreakOrder: score.tiebreakOrder,
      allowShared: context.config.allowSharedPlacement,
      requiresWinner: context.requiresWinner,
      // match_entries.points is an integer; decimals stay in result data.
      points: (seat) =>
        context.config.decimals === 0
          ? read(score, seat)!
          : Math.round(read(score, seat)! * factor),
    });
    return {
      placements,
      winnerSeats: placements
        .filter((row) => row.placement === 1)
        .map((row) => row.seat),
      displayScore: display(score, context),
      resultData: {
        values: score.values,
        unit: context.config.unit,
        decimals: context.config.decimals,
        tiebreakOrder: score.tiebreakOrder,
      },
    };
  },
  display,
};

function display(score: Score, context: ScoringContext<Config>) {
  const text = context.seats
    .map((seat) => {
      const entry = read(score, seat);
      return entry === null ? "–" : entry.toFixed(context.config.decimals);
    })
    .join(context.seats.length === 2 ? " – " : " · ");
  return context.config.unit ? `${text} ${context.config.unit}` : text;
}
