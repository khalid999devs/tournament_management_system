import { z } from "zod";
import {
  invalid,
  type CanonicalResult,
  type ScoringAdapter,
  type ScoringContext,
} from "../domain/types";

const configSchema = z
  .object({
    targetPoints: z.coerce
      .number()
      .int()
      .min(1)
      .max(500)
      .nullable()
      .default(25),
    maxBoards: z.coerce.number().int().min(1).max(50).nullable().default(8),
    maxPointsPerBoard: z.coerce.number().int().min(1).max(100).default(13),
  })
  .refine(
    (config) => config.targetPoints !== null || config.maxBoards !== null,
    {
      message: "Set a points target, a board limit, or both.",
      path: ["targetPoints"],
    },
  );

const board = z.object({
  seat: z.number().int().min(1),
  points: z.number().int().min(0).max(100),
});

const scoreSchema = z.object({
  boards: z.array(board).max(60).default([]),
});

const eventSchema = z.object({
  type: z.literal("BOARD"),
  seat: z.number().int().min(1),
  points: z.number().int().min(0).max(100),
});

type Config = z.infer<typeof configSchema>;
type Score = z.infer<typeof scoreSchema>;
type Event = z.infer<typeof eventSchema>;

function totals(score: Score, seats: number[]) {
  return seats.map((seat) =>
    score.boards
      .filter((item) => item.seat === seat)
      .reduce((total, item) => total + item.points, 0),
  ) as [number, number];
}

// Over when someone reaches the target, or when the board limit is played
// with a leader. Level after the limit means a tie-break board.
function isOver(score: Score, context: ScoringContext<Config>) {
  const [a, b] = totals(score, context.seats);
  const { targetPoints, maxBoards } = context.config;
  if (targetPoints !== null && Math.max(a, b) >= targetPoints) return true;
  return maxBoards !== null && score.boards.length >= maxBoards && a !== b;
}

function check(score: Score, context: ScoringContext<Config>) {
  score.boards.forEach((item, index) => {
    if (!context.seats.includes(item.seat)) {
      invalid(`Board ${index + 1} is recorded for a player not in this match.`);
    }
    if (item.points > context.config.maxPointsPerBoard) {
      invalid(
        `A board is worth at most ${context.config.maxPointsPerBoard} points.`,
      );
    }
    if (isOver({ boards: score.boards.slice(0, index) }, context)) {
      invalid(`Board ${index + 1} was played after the match was already won.`);
    }
  });
}

export const carromPointsAdapter: ScoringAdapter<Config, Score, Event> = {
  key: "CARROM_POINTS",
  label: "Boards and points",
  summary:
    "Each board's winner and points; first to the target, or the leader after the board limit, wins.",
  examples: "Carrom, darts legs, pool frames",
  defaultProgression: "AUTOMATIC_SINGLE_ELIMINATION",
  seats: { min: 2, max: 2 },
  configSchema,
  configFields: [
    {
      kind: "number",
      name: "targetPoints",
      label: "Points to win",
      help: "Optional if a board limit is set.",
      min: 1,
      max: 500,
      optional: true,
    },
    {
      kind: "number",
      name: "maxBoards",
      label: "Board limit",
      help: "Optional. The leader after this many boards wins; a level score adds tie-break boards.",
      min: 1,
      max: 50,
      optional: true,
    },
    {
      kind: "number",
      name: "maxPointsPerBoard",
      label: "Most points on one board",
      min: 1,
      max: 100,
    },
  ],
  scoreSchema,
  eventSchema,
  emptyScore: () => ({ boards: [] }),
  applyEvent(score, event, context) {
    if (isOver(score, context))
      invalid("The match is already won. Finalize it.");
    const next = {
      boards: [...score.boards, { seat: event.seat, points: event.points }],
    };
    check(next, context);
    return next;
  },
  validateScore: check,
  finalize(score, context): CanonicalResult {
    check(score, context);
    if (!isOver(score, context)) {
      invalid(
        "The match is not over yet: no one has reached the target or led after the board limit.",
      );
    }
    const sums = totals(score, context.seats);
    const winnerIndex = sums[0] > sums[1] ? 0 : 1;
    const winner = context.seats[winnerIndex];
    const loser = context.seats[1 - winnerIndex];
    return {
      placements: [
        {
          seat: winner,
          placement: 1,
          points: sums[winnerIndex],
          outcome: "WIN",
        },
        {
          seat: loser,
          placement: 2,
          points: sums[1 - winnerIndex],
          outcome: "LOSS",
        },
      ],
      winnerSeats: [winner],
      displayScore: display(score, context),
      resultData: { boards: score.boards, totals: sums },
    };
  },
  display,
};

function display(score: Score, context: ScoringContext<Config>) {
  const [a, b] = totals(score, context.seats);
  const count = score.boards.length;
  return `${a}–${b} (${count} ${count === 1 ? "board" : "boards"})`;
}

export const carromScoring = { totals, isOver };
