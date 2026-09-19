import { z } from "zod";
import {
  invalid,
  ScoringError,
  type CanonicalResult,
  type ScoringAdapter,
  type ScoringContext,
} from "../domain/types";

const points = z.number().int().min(0).max(999);

const configSchema = z
  .object({
    bestOf: z.coerce
      .number()
      .int()
      .refine((value) => [1, 3, 5, 7].includes(value), "Choose 1, 3, 5 or 7.")
      .default(5),
    pointsPerSet: z.coerce.number().int().min(1).max(99).default(11),
    winBy: z.coerce.number().int().min(1).max(2).default(2),
    pointCap: z.coerce.number().int().min(1).max(199).nullable().default(null),
    deciderPoints: z.coerce
      .number()
      .int()
      .min(1)
      .max(99)
      .nullable()
      .default(null),
  })
  .refine(
    (config) =>
      config.pointCap === null ||
      config.pointCap >
        Math.max(config.pointsPerSet, config.deciderPoints ?? 0),
    {
      message: "The point cap must be above the set target.",
      path: ["pointCap"],
    },
  );

const scoreSchema = z.object({
  sets: z
    .array(z.tuple([points, points]))
    .max(7)
    .default([]),
});

const eventSchema = z.discriminatedUnion("type", [
  // One rally or point. `set` is the set the operator was looking at, so a
  // late tap cannot land in the wrong set.
  z.object({
    type: z.literal("POINT"),
    seat: z.number().int().min(1),
    set: z.number().int().min(1).max(7),
  }),
  // A whole set typed in after it was played.
  z.object({
    type: z.literal("SET"),
    set: z.number().int().min(1).max(7),
    points: z.tuple([points, points]),
  }),
]);

type Config = z.infer<typeof configSchema>;
type Score = z.infer<typeof scoreSchema>;
type Event = z.infer<typeof eventSchema>;
type Pair = [number, number];

const setsToWin = (config: Config) => Math.ceil(config.bestOf / 2);

function target(config: Config, index: number) {
  return index === config.bestOf - 1 && config.deciderPoints
    ? config.deciderPoints
    : config.pointsPerSet;
}

function isComplete(pair: Pair, config: Config, index: number) {
  const high = Math.max(...pair);
  const low = Math.min(...pair);
  return (
    high >= target(config, index) &&
    (high - low >= config.winBy ||
      (config.pointCap !== null && high >= config.pointCap))
  );
}

// A finished set is legal only if the last point is what finished it.
function isLegalFinished(pair: Pair, config: Config, index: number) {
  if (!isComplete(pair, config, index) || pair[0] === pair[1]) return false;
  const winner = pair[0] > pair[1] ? 0 : 1;
  const before: Pair = [...pair];
  before[winner] -= 1;
  return !isComplete(before, config, index);
}

function setsWon(score: Score, config: Config): Pair {
  const won: Pair = [0, 0];
  score.sets.forEach((pair, index) => {
    if (isComplete(pair, config, index)) won[pair[0] > pair[1] ? 0 : 1] += 1;
  });
  return won;
}

function isDecided(score: Score, config: Config) {
  return Math.max(...setsWon(score, config)) >= setsToWin(config);
}

// 1-based number of the set that the next point belongs to.
function currentSet(score: Score, config: Config) {
  const last = score.sets.length - 1;
  if (last >= 0 && !isComplete(score.sets[last], config, last)) return last + 1;
  return score.sets.length + 1;
}

function check(score: Score, context: ScoringContext<Config>) {
  const { config } = context;
  if (score.sets.length > config.bestOf) {
    invalid(`This game is best of ${config.bestOf}.`);
  }
  const won: Pair = [0, 0];
  score.sets.forEach((pair, index) => {
    if (Math.max(...won) >= setsToWin(config)) {
      invalid(
        `Set ${index + 1} was played after the match was already decided.`,
      );
    }
    const last = index === score.sets.length - 1;
    if (isComplete(pair, config, index)) {
      if (!isLegalFinished(pair, config, index)) {
        invalid(
          `Set ${index + 1} score ${pair[0]}–${pair[1]} is not possible.`,
        );
      }
      won[pair[0] > pair[1] ? 0 : 1] += 1;
    } else if (!last) {
      invalid(`Set ${index + 1} is not finished.`);
    }
  });
}

export const setsAdapter: ScoringAdapter<Config, Score, Event> = {
  key: "SETS",
  label: "Best-of sets",
  summary:
    "Points per set; the server works out sets won and the winner from the configured format.",
  examples: "Table tennis, badminton, volleyball, squash",
  defaultProgression: "AUTOMATIC_SINGLE_ELIMINATION",
  seats: { min: 2, max: 2 },
  configSchema,
  configFields: [
    {
      kind: "select",
      name: "bestOf",
      label: "Match format",
      options: [1, 3, 5, 7].map((value) => ({
        value: String(value),
        label: `Best of ${value}`,
      })),
    },
    {
      kind: "number",
      name: "pointsPerSet",
      label: "Points to win a set",
      min: 1,
      max: 99,
    },
    {
      kind: "select",
      name: "winBy",
      label: "Winning margin",
      options: [
        { value: "2", label: "Win by 2 (deuce)" },
        { value: "1", label: "First to the target" },
      ],
    },
    {
      kind: "number",
      name: "pointCap",
      label: "Point cap",
      help: "Optional. The first to this score wins the set even by one point (badminton: 30).",
      min: 1,
      max: 199,
      optional: true,
    },
    {
      kind: "number",
      name: "deciderPoints",
      label: "Points in the deciding set",
      help: "Optional. Leave empty if the final set uses the normal target (volleyball: 15).",
      min: 1,
      max: 99,
      optional: true,
    },
  ],
  scoreSchema,
  eventSchema,
  emptyScore: () => ({ sets: [] }),
  applyEvent(score, event, context, options) {
    const { config } = context;
    if (isDecided(score, config))
      invalid("The match is already decided. Finalize it.");

    const current = currentSet(score, config);
    if (event.set !== current) {
      const message = `Set ${event.set} is already finished; the match is on set ${current}.`;
      if (options?.replay) invalid(message);
      throw new ScoringError("STALE_MATCH_VERSION", message);
    }
    if (current > config.bestOf)
      invalid(`This game is best of ${config.bestOf}.`);

    const sets = score.sets.map((pair) => [...pair] as Pair);
    if (event.type === "POINT") {
      const index = context.seats.indexOf(event.seat);
      if (index === -1) invalid("Pick one of the players in this match.");
      if (sets.length < current) sets.push([0, 0]);
      sets[current - 1][index] += 1;
    } else {
      const existing = sets[current - 1];
      if (existing && (existing[0] > 0 || existing[1] > 0)) {
        invalid(
          `Set ${current} already has points. Continue it point by point.`,
        );
      }
      if (!isLegalFinished(event.points, config, current - 1)) {
        invalid(
          `Set ${current} score ${event.points[0]}–${event.points[1]} is not a finished set.`,
        );
      }
      sets[current - 1] = [...event.points];
    }

    const next = { sets };
    check(next, context);
    return next;
  },
  validateScore: check,
  finalize(score, context): CanonicalResult {
    check(score, context);
    const { config } = context;
    const won = setsWon(score, config);
    if (Math.max(...won) < setsToWin(config)) {
      invalid(`A player needs ${setsToWin(config)} sets to win.`);
    }
    const winnerIndex = won[0] > won[1] ? 0 : 1;
    const winner = context.seats[winnerIndex];
    const loser = context.seats[1 - winnerIndex];
    return {
      placements: [
        {
          seat: winner,
          placement: 1,
          points: won[winnerIndex],
          outcome: "WIN",
        },
        {
          seat: loser,
          placement: 2,
          points: won[1 - winnerIndex],
          outcome: "LOSS",
        },
      ],
      winnerSeats: [winner],
      displayScore: display(score, context),
      resultData: { sets: score.sets, setsWon: won },
    };
  },
  display,
};

function display(score: Score, context: ScoringContext<Config>) {
  if (score.sets.length === 0) return "0–0";
  const won = setsWon(score, context.config);
  const detail = score.sets.map((pair) => `${pair[0]}–${pair[1]}`).join(", ");
  return `${won[0]}–${won[1]} (${detail})`;
}

export const setsScoring = { currentSet, isDecided, setsWon, isComplete };
