import { describe, expect, it } from "vitest";
import {
  buildSingleElimination,
  matchCodePrefix,
  roundName,
  seedPositions,
  shuffle,
} from "@/features/matches/domain/bracket";
import { replayScore, updateTypes } from "@/features/matches/domain/commands";
import {
  buildScoringContext,
  getScoringAdapter,
} from "@/features/scoring/adapters";

const players = (count: number) =>
  Array.from({ length: count }, (_, index) => `p${index + 1}`);

describe("seedPositions", () => {
  it("keeps the top seeds apart", () => {
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("buildSingleElimination", () => {
  it("builds a plain final for two players", () => {
    const rounds = buildSingleElimination(players(2), "CHE");
    expect(rounds).toHaveLength(1);
    expect(rounds[0].name).toBe("Final");
    expect(rounds[0].matches[0]).toMatchObject({
      code: "CHE-F",
      seats: ["p1", "p2"],
      next: null,
    });
  });

  it("gives byes to the top seeds and places them in round two", () => {
    const rounds = buildSingleElimination(players(5), "TT");
    expect(rounds.map((round) => round.name)).toEqual([
      "Quarter-finals",
      "Semi-finals",
      "Final",
    ]);
    // Only 4 v 5 is played in the first round.
    expect(rounds[0].matches).toHaveLength(1);
    expect(rounds[0].matches[0].seats).toEqual(["p4", "p5"]);
    expect(rounds[0].matches[0].next).toEqual({ round: 2, slot: 0, seat: 2 });
    expect(rounds[1].matches[0].seats).toEqual(["p1", null]);
    expect(rounds[1].matches[1].seats).toEqual(["p2", "p3"]);
    expect(rounds[2].matches[0].seats).toEqual([null, null]);
  });

  it.each([3, 6, 7, 9, 13, 16, 33, 64])(
    "never pairs two byes with %i players",
    (count) => {
      const rounds = buildSingleElimination(players(count), "X");
      const size = 2 ** Math.ceil(Math.log2(count));
      const firstRoundPlayers = rounds[0].matches.length * 2;
      const byes = size - count;
      expect(firstRoundPlayers + byes).toBe(count);
      expect(
        rounds[0].matches.every((match) => match.seats[0] && match.seats[1]),
      ).toBe(true);
      // Every player appears exactly once before any result is entered.
      const placed = rounds
        .flatMap((round) => round.matches.flatMap((match) => match.seats))
        .filter(Boolean);
      expect(new Set(placed).size).toBe(count);
      expect(placed).toHaveLength(count);
    },
  );

  it("links every non-final match to a real next-match seat", () => {
    const rounds = buildSingleElimination(players(12), "X");
    const seats = new Set<string>();
    for (const round of rounds.slice(0, -1)) {
      for (const match of round.matches) {
        expect(match.next).not.toBeNull();
        const key = `${match.next!.round}:${match.next!.slot}:${match.next!.seat}`;
        expect(seats.has(key)).toBe(false);
        seats.add(key);
      }
    }
    const codes = rounds.flatMap((round) =>
      round.matches.map((match) => `${round.sequence}:${match.code}`),
    );
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("rejects too few or duplicate players", () => {
    expect(() => buildSingleElimination(["a"], "X")).toThrow();
    expect(() => buildSingleElimination(["a", "a"], "X")).toThrow();
  });
});

describe("naming", () => {
  it("names rounds and match codes", () => {
    expect(roundName(16)).toBe("Round of 16");
    expect(matchCodePrefix("Chess")).toBe("CHE");
    expect(matchCodePrefix("Table Tennis")).toBe("TT");
    expect(matchCodePrefix("29 Cards")).toBe("29C");
    expect(matchCodePrefix("Mobile Football")).toBe("MF");
  });

  it("shuffles deterministically with a fixed source", () => {
    const random = () => 0;
    expect(shuffle([1, 2, 3], random)).toEqual([2, 3, 1]);
  });
});

describe("replayScore", () => {
  it("skips voided events and honours typed scores", () => {
    const adapter = getScoringAdapter("GOALS");
    const context = buildScoringContext({
      adapterKey: "GOALS",
      config: {},
      seats: [1, 2],
      progressionMode: "AUTOMATIC_SINGLE_ELIMINATION",
    });
    const goal = (id: string, seat: number) => ({
      id,
      updateType: updateTypes.SCORE_EVENT,
      payload: { event: { type: "GOAL", seat, phase: "REGULAR" } },
    });
    const score = replayScore(adapter, context, [
      goal("a", 1),
      goal("b", 1),
      {
        id: "c",
        updateType: updateTypes.SCORE_VOIDED,
        payload: { updateId: "a" },
      },
      goal("d", 2),
    ]);
    expect(score).toEqual({
      regular: [1, 1],
      extraTime: null,
      penalties: null,
    });

    const typed = replayScore(adapter, context, [
      goal("a", 1),
      {
        id: "b",
        updateType: updateTypes.SCORE_SET,
        payload: { score: { regular: [4, 0] } },
      },
      goal("c", 2),
    ]);
    expect(typed).toEqual({
      regular: [4, 1],
      extraTime: null,
      penalties: null,
    });
  });
});
