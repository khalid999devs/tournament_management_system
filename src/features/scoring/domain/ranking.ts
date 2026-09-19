import { invalid, type MatchOutcome, type Placement } from "./types";

export type RankInput = {
  seats: number[];
  value: (seat: number) => number;
  higherIsBetter: boolean;
  // Seats listed best-first; used only to split seats with equal values.
  tiebreakOrder?: number[] | null;
  allowShared: boolean;
  requiresWinner: boolean;
  points?: (seat: number) => number | undefined;
};

// Standard competition ranking (1, 2, 2, 4). A tie is split by the operator's
// tie-break order when given; otherwise it stays shared if the game allows it
// and is rejected if not, so a tie is never resolved by accident.
export function rankSeats(input: RankInput): Placement[] {
  const sign = input.higherIsBetter ? -1 : 1;
  const tiebreak = input.tiebreakOrder ?? [];
  const tiebreakIndex = (seat: number) => {
    const index = tiebreak.indexOf(seat);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  const sorted = [...input.seats].sort(
    (a, b) =>
      sign * (input.value(a) - input.value(b)) ||
      tiebreakIndex(a) - tiebreakIndex(b) ||
      a - b,
  );

  const placements: Placement[] = [];
  sorted.forEach((seat, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    const tiedWithPrevious =
      previous !== null &&
      input.value(previous) === input.value(seat) &&
      !(
        tiebreakIndex(previous) !== Number.POSITIVE_INFINITY &&
        tiebreakIndex(seat) !== Number.POSITIVE_INFINITY
      );

    const placement = tiedWithPrevious
      ? placements[index - 1].placement
      : index + 1;
    placements.push({
      seat,
      placement,
      points: input.points?.(seat),
      outcome: "LOSS",
    });
  });

  const tied = placements.filter((row) =>
    placements.some(
      (other) => other.seat !== row.seat && other.placement === row.placement,
    ),
  );
  if (tied.length > 0) {
    const topTied = tied.some((row) => row.placement === 1);
    if (!input.allowShared || (topTied && input.requiresWinner)) {
      invalid(
        `Seats ${tied.map((row) => row.seat).join(", ")} are tied. Set a tie-break order before finalizing.`,
      );
    }
  }

  const winners = placements.filter((row) => row.placement === 1);
  const outcome: MatchOutcome = winners.length > 1 ? "DRAW" : "WIN";
  return placements.map((row) => ({
    ...row,
    outcome: row.placement === 1 ? outcome : "LOSS",
  }));
}

export function ordinal(value: number) {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[
          value % 10
        ] ?? "th");
  return `${value}${suffix}`;
}
