import { z } from "zod";
import {
  invalid,
  type CanonicalResult,
  type ScoringAdapter,
  type ScoringContext,
} from "../domain/types";

const configSchema = z.object({
  allowDraws: z.boolean().default(true),
});

const scoreSchema = z.object({
  winnerSeat: z.number().int().min(1).nullable().default(null),
  draw: z.boolean().default(false),
  // Armageddon or similar decider when the game itself was drawn.
  tiebreakWinnerSeat: z.number().int().min(1).nullable().default(null),
  note: z.string().trim().max(300).nullable().default(null),
});

type Config = z.infer<typeof configSchema>;
type Score = z.infer<typeof scoreSchema>;

function check(score: Score, context: ScoringContext<Config>) {
  const known = (seat: number | null) =>
    seat === null || context.seats.includes(seat);
  if (!known(score.winnerSeat) || !known(score.tiebreakWinnerSeat)) {
    invalid("Pick one of the players in this match.");
  }
  if (score.draw && score.winnerSeat !== null) {
    invalid("A game cannot be both a draw and a win.");
  }
  if (!score.draw && score.tiebreakWinnerSeat !== null) {
    invalid("A tie-break winner applies only to a drawn game.");
  }
}

export const chessOutcomeAdapter: ScoringAdapter<Config, Score, never> = {
  key: "CHESS_OUTCOME",
  label: "Win / draw / loss",
  summary:
    "The operator records who won, or a draw with an optional tie-break winner.",
  examples: "Chess, Ludo 1v1, most board games",
  defaultProgression: "AUTOMATIC_SINGLE_ELIMINATION",
  seats: { min: 2, max: 2 },
  configSchema,
  configFields: [
    {
      kind: "boolean",
      name: "allowDraws",
      label: "Draws can stand as a final result",
      help: "Only in manually progressed games. Knockout games always need a tie-break winner after a draw.",
    },
  ],
  scoreSchema,
  eventSchema: null,
  emptyScore: () => scoreSchema.parse({}),
  applyEvent: () => invalid("This game records only a final outcome."),
  validateScore: check,
  finalize(score, context): CanonicalResult {
    check(score, context);
    const [first, second] = context.seats;
    const needsWinner = context.requiresWinner || !context.config.allowDraws;

    if (score.winnerSeat === null && !score.draw) {
      invalid("Record the outcome before finalizing.");
    }

    const decidedBy = score.draw ? score.tiebreakWinnerSeat : score.winnerSeat;
    if (score.draw && decidedBy === null && needsWinner) {
      invalid("This game needs a winner. Record the tie-break winner.");
    }

    if (decidedBy === null) {
      return {
        placements: context.seats.map((seat) => ({
          seat,
          placement: 1,
          outcome: "DRAW",
        })),
        winnerSeats: [],
        displayScore: "½–½",
        resultData: { draw: true, note: score.note },
      };
    }

    const loser = decidedBy === first ? second : first;
    return {
      placements: [
        { seat: decidedBy, placement: 1, outcome: "WIN" },
        { seat: loser, placement: 2, outcome: "LOSS" },
      ],
      winnerSeats: [decidedBy],
      displayScore: display(score, context),
      resultData: {
        draw: score.draw,
        tiebreakWinnerSeat: score.tiebreakWinnerSeat,
        note: score.note,
      },
    };
  },
  display,
};

function display(score: Score, context: ScoringContext<Config>) {
  const [first] = context.seats;
  if (score.draw) {
    return score.tiebreakWinnerSeat === null
      ? "½–½"
      : `½–½, tie-break ${score.tiebreakWinnerSeat === first ? "1–0" : "0–1"}`;
  }
  if (score.winnerSeat === null) return "Not played";
  return score.winnerSeat === first ? "1–0" : "0–1";
}
