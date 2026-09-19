import { z } from "zod";
import {
  invalid,
  type CanonicalResult,
  type ScoringAdapter,
  type ScoringContext,
} from "../domain/types";

const goals = z.number().int().min(0).max(99);
const pair = z.tuple([goals, goals]);

const configSchema = z.object({
  extraTime: z.boolean().default(true),
  penalties: z.boolean().default(true),
  allowDraws: z.boolean().default(false),
});

const scoreSchema = z.object({
  regular: pair.default([0, 0]),
  extraTime: pair.nullable().default(null),
  penalties: pair.nullable().default(null),
});

const phases = ["REGULAR", "EXTRA_TIME", "PENALTIES"] as const;

const eventSchema = z.object({
  type: z.literal("GOAL"),
  seat: z.number().int().min(1),
  phase: z.enum(phases).default("REGULAR"),
});

type Config = z.infer<typeof configSchema>;
type Score = z.infer<typeof scoreSchema>;
type Event = z.infer<typeof eventSchema>;

const sum = (a: [number, number], b: [number, number] | null) =>
  [a[0] + (b?.[0] ?? 0), a[1] + (b?.[1] ?? 0)] as [number, number];

function check(score: Score, context: ScoringContext<Config>) {
  if (score.extraTime && !context.config.extraTime) {
    invalid("Extra time is not played in this game.");
  }
  if (score.penalties && !context.config.penalties) {
    invalid("Penalties are not used in this game.");
  }
  const afterExtra = sum(score.regular, score.extraTime);
  if (score.extraTime && score.regular[0] !== score.regular[1]) {
    invalid("Extra time is only played when regular time ends level.");
  }
  if (score.penalties && afterExtra[0] !== afterExtra[1]) {
    invalid("Penalties are only taken when the score is level.");
  }
}

export const goalsAdapter: ScoringAdapter<Config, Score, Event> = {
  key: "GOALS",
  label: "Goals",
  summary: "Goals in regular time, with optional extra time and penalties.",
  examples: "eFootball, FIFA, foosball, hockey",
  defaultProgression: "AUTOMATIC_SINGLE_ELIMINATION",
  seats: { min: 2, max: 2 },
  configSchema,
  configFields: [
    { kind: "boolean", name: "extraTime", label: "Extra time if level" },
    {
      kind: "boolean",
      name: "penalties",
      label: "Penalty shoot-out if still level",
    },
    {
      kind: "boolean",
      name: "allowDraws",
      label: "Draws can stand as a final result",
      help: "Only in manually progressed games.",
    },
  ],
  scoreSchema,
  eventSchema,
  emptyScore: () => scoreSchema.parse({}),
  applyEvent(score, event, context) {
    const index = context.seats.indexOf(event.seat);
    if (index === -1) invalid("Pick one of the sides in this match.");

    const next: Score = {
      regular: [...score.regular],
      extraTime: score.extraTime ? [...score.extraTime] : null,
      penalties: score.penalties ? [...score.penalties] : null,
    };
    if (event.phase === "REGULAR") {
      if (next.extraTime || next.penalties) {
        invalid(
          "Regular time is over. Undo extra-time or penalty goals first.",
        );
      }
      next.regular[index] += 1;
    } else if (event.phase === "EXTRA_TIME") {
      if (next.penalties) invalid("The shoot-out has already started.");
      next.extraTime = next.extraTime ?? [0, 0];
      next.extraTime[index] += 1;
    } else {
      next.penalties = next.penalties ?? [0, 0];
      next.penalties[index] += 1;
    }
    check(next, context);
    return next;
  },
  validateScore: check,
  finalize(score, context): CanonicalResult {
    check(score, context);
    const [first, second] = context.seats;
    const afterExtra = sum(score.regular, score.extraTime);

    let winnerIndex: number | null = null;
    if (afterExtra[0] !== afterExtra[1]) {
      winnerIndex = afterExtra[0] > afterExtra[1] ? 0 : 1;
    } else if (score.penalties) {
      if (score.penalties[0] === score.penalties[1]) {
        invalid("The shoot-out must have a winner.");
      }
      winnerIndex = score.penalties[0] > score.penalties[1] ? 0 : 1;
    }

    const displayScore = display(score);
    const resultData = {
      regular: score.regular,
      extraTime: score.extraTime,
      penalties: score.penalties,
    };

    if (winnerIndex === null) {
      if (context.requiresWinner || !context.config.allowDraws) {
        invalid("The score is level. Record extra time or penalties.");
      }
      return {
        placements: [
          { seat: first, placement: 1, points: afterExtra[0], outcome: "DRAW" },
          {
            seat: second,
            placement: 1,
            points: afterExtra[1],
            outcome: "DRAW",
          },
        ],
        winnerSeats: [],
        displayScore,
        resultData,
      };
    }

    const winner = context.seats[winnerIndex];
    const loser = context.seats[1 - winnerIndex];
    return {
      placements: [
        {
          seat: winner,
          placement: 1,
          points: afterExtra[winnerIndex],
          outcome: "WIN",
        },
        {
          seat: loser,
          placement: 2,
          points: afterExtra[1 - winnerIndex],
          outcome: "LOSS",
        },
      ],
      winnerSeats: [winner],
      displayScore,
      resultData,
    };
  },
  display,
};

function display(score: Score) {
  const total = sum(score.regular, score.extraTime);
  let text = `${total[0]}–${total[1]}`;
  if (score.extraTime) text += " aet";
  if (score.penalties) {
    text += `, ${score.penalties[0]}–${score.penalties[1]} pens`;
  }
  return text;
}
