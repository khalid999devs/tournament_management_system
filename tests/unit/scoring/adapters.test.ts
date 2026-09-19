import { describe, expect, it } from "vitest";
import {
  buildScoringContext,
  getScoringAdapter,
  scoringAdapterList,
  type AnyScoringAdapter,
} from "@/features/scoring/adapters";
import { rankSeats } from "@/features/scoring/domain/ranking";
import { ScoringError } from "@/features/scoring/domain/types";

function setup(
  key: string,
  config: unknown = {},
  seats = [1, 2],
  automatic = true,
) {
  const adapter = getScoringAdapter(key);
  const context = buildScoringContext({
    adapterKey: key,
    config,
    seats,
    progressionMode: automatic ? "AUTOMATIC_SINGLE_ELIMINATION" : "MANUAL",
  });
  // Events go through the adapter's schema first, exactly as on the server.
  const apply = (events: unknown[], start = adapter.emptyScore(context)) =>
    events.reduce(
      (score, event) =>
        adapter.applyEvent(score, adapter.eventSchema!.parse(event), context),
      start,
    );
  return { adapter, context, apply };
}

const invalidScore = (run: () => unknown) =>
  expect(run).toThrow(expect.objectContaining({ code: "INVALID_SCORE" }));
const staleScore = (run: () => unknown) =>
  expect(run).toThrow(expect.objectContaining({ code: "STALE_MATCH_VERSION" }));

describe("every adapter", () => {
  it.each(
    scoringAdapterList.map(
      (adapter) => [adapter.key, adapter as AnyScoringAdapter] as const,
    ),
  )("%s has parseable default settings and an empty score", (key, adapter) => {
    const config = adapter.configSchema.parse({});
    const context = { config, seats: [1, 2], requiresWinner: true };
    expect(adapter.scoreSchema.parse(adapter.emptyScore(context))).toBeTruthy();
    expect(typeof adapter.display(adapter.emptyScore(context), context)).toBe(
      "string",
    );
    expect(adapter.configFields.length).toBeGreaterThan(0);
    expect(key).toMatch(/^[A-Z_]+$/);
  });
});

describe("CHESS_OUTCOME", () => {
  it("records a win", () => {
    const { adapter, context } = setup("CHESS_OUTCOME");
    const result = adapter.finalize(
      { winnerSeat: 2, draw: false, tiebreakWinnerSeat: null, note: null },
      context,
    );
    expect(result.winnerSeats).toEqual([2]);
    expect(result.displayScore).toBe("0–1");
    expect(result.placements).toContainEqual({
      seat: 1,
      placement: 2,
      outcome: "LOSS",
    });
  });

  it("requires a tie-break winner after a knockout draw", () => {
    const { adapter, context } = setup("CHESS_OUTCOME");
    const draw = {
      winnerSeat: null,
      draw: true,
      tiebreakWinnerSeat: null,
      note: null,
    };
    invalidScore(() => adapter.finalize(draw, context));
    const result = adapter.finalize(
      { ...draw, tiebreakWinnerSeat: 1 },
      context,
    );
    expect(result.winnerSeats).toEqual([1]);
    expect(result.displayScore).toBe("½–½, tie-break 1–0");
  });

  it("lets a draw stand in manual games that allow it", () => {
    const { adapter, context } = setup(
      "CHESS_OUTCOME",
      { allowDraws: true },
      [1, 2],
      false,
    );
    const result = adapter.finalize(
      { winnerSeat: null, draw: true, tiebreakWinnerSeat: null, note: null },
      context,
    );
    expect(result.winnerSeats).toEqual([]);
    expect(result.placements.every((row) => row.outcome === "DRAW")).toBe(true);
  });

  it("rejects contradictory outcomes and live events", () => {
    const { adapter, context } = setup("CHESS_OUTCOME");
    invalidScore(() =>
      adapter.validateScore(
        { winnerSeat: 1, draw: true, tiebreakWinnerSeat: null, note: null },
        context,
      ),
    );
    invalidScore(() =>
      adapter.validateScore(
        { winnerSeat: 3, draw: false, tiebreakWinnerSeat: null, note: null },
        context,
      ),
    );
    invalidScore(() => adapter.finalize(adapter.emptyScore(context), context));
  });
});

describe("GOALS", () => {
  it("counts goals and decides on penalties after extra time", () => {
    const { adapter, context, apply } = setup("GOALS");
    const score = apply([
      { type: "GOAL", seat: 1 },
      { type: "GOAL", seat: 2 },
      { type: "GOAL", seat: 2, phase: "EXTRA_TIME" },
      { type: "GOAL", seat: 1, phase: "EXTRA_TIME" },
      { type: "GOAL", seat: 1, phase: "PENALTIES" },
    ]);
    const result = adapter.finalize(score, context);
    expect(result.winnerSeats).toEqual([1]);
    expect(result.displayScore).toBe("2–2 aet, 1–0 pens");
  });

  it("refuses a level knockout result and illegal phases", () => {
    const { adapter, context, apply } = setup("GOALS");
    invalidScore(() =>
      adapter.finalize(
        apply([
          { type: "GOAL", seat: 1 },
          { type: "GOAL", seat: 2 },
        ]),
        context,
      ),
    );
    invalidScore(() =>
      apply([
        { type: "GOAL", seat: 1 },
        { type: "GOAL", seat: 1, phase: "EXTRA_TIME" },
      ]),
    );
    invalidScore(() =>
      apply([
        { type: "GOAL", seat: 1, phase: "EXTRA_TIME" },
        { type: "GOAL", seat: 1 },
      ]),
    );
    invalidScore(() => apply([{ type: "GOAL", seat: 3 }]));
  });

  it("respects disabled extra time", () => {
    const { apply } = setup("GOALS", { extraTime: false });
    invalidScore(() => apply([{ type: "GOAL", seat: 1, phase: "EXTRA_TIME" }]));
  });
});

describe("SETS", () => {
  const point = (seat: number, set: number) => ({ type: "POINT", seat, set });

  it("plays a best-of-3 to 11 with deuce", () => {
    const { adapter, context, apply } = setup("SETS", { bestOf: 3 });
    const score = apply([
      { type: "SET", set: 1, points: [11, 7] },
      { type: "SET", set: 2, points: [10, 12] },
      { type: "SET", set: 3, points: [11, 9] },
    ]);
    const result = adapter.finalize(score, context);
    expect(result.winnerSeats).toEqual([1]);
    expect(result.displayScore).toBe("2–1 (11–7, 10–12, 11–9)");
  });

  it("moves to the next set automatically and rejects a late tap for a finished set", () => {
    const { apply, adapter, context } = setup("SETS", {
      bestOf: 3,
      pointsPerSet: 3,
      winBy: 1,
    });
    const score = apply([point(1, 1), point(1, 1), point(1, 1), point(2, 2)]);
    expect(score).toEqual({
      sets: [
        [3, 0],
        [0, 1],
      ],
    });
    staleScore(() => adapter.applyEvent(score, point(1, 1), context));
  });

  it("rejects impossible set scores", () => {
    const { adapter, context, apply } = setup("SETS", { bestOf: 3 });
    invalidScore(() => apply([{ type: "SET", set: 1, points: [13, 5] }]));
    invalidScore(() => apply([{ type: "SET", set: 1, points: [11, 10] }]));
    invalidScore(() =>
      adapter.validateScore(
        {
          sets: [
            [11, 3],
            [11, 4],
            [11, 2],
          ],
        },
        context,
      ),
    );
    invalidScore(() => adapter.finalize({ sets: [[11, 3]] }, context));
  });

  it("supports a point cap and a shorter deciding set", () => {
    const badminton = setup("SETS", {
      bestOf: 3,
      pointsPerSet: 21,
      pointCap: 30,
    });
    expect(() =>
      badminton.apply([{ type: "SET", set: 1, points: [30, 29] }]),
    ).not.toThrow();
    invalidScore(() =>
      badminton.apply([{ type: "SET", set: 1, points: [31, 29] }]),
    );

    const volleyball = setup("SETS", {
      bestOf: 3,
      pointsPerSet: 25,
      deciderPoints: 15,
    });
    const score = volleyball.apply([
      { type: "SET", set: 1, points: [25, 20] },
      { type: "SET", set: 2, points: [20, 25] },
      { type: "SET", set: 3, points: [15, 11] },
    ]);
    expect(
      volleyball.adapter.finalize(score, volleyball.context).winnerSeats,
    ).toEqual([1]);
  });

  it("refuses points after the match is decided", () => {
    const { apply } = setup("SETS", { bestOf: 1, pointsPerSet: 2, winBy: 1 });
    invalidScore(() => apply([point(1, 1), point(1, 1), point(2, 2)]));
  });
});

describe("CARROM_POINTS", () => {
  it("ends when a player reaches the target", () => {
    const { adapter, context, apply } = setup("CARROM_POINTS", {
      targetPoints: 25,
      maxBoards: null,
    });
    const score = apply([
      { type: "BOARD", seat: 1, points: 12 },
      { type: "BOARD", seat: 2, points: 7 },
      { type: "BOARD", seat: 1, points: 13 },
    ]);
    const result = adapter.finalize(score, context);
    expect(result.winnerSeats).toEqual([1]);
    expect(result.displayScore).toBe("25–7 (3 boards)");
    invalidScore(() =>
      adapter.applyEvent(score, { type: "BOARD", seat: 2, points: 3 }, context),
    );
  });

  it("adds tie-break boards when level after the board limit", () => {
    const { adapter, context, apply } = setup("CARROM_POINTS", {
      targetPoints: null,
      maxBoards: 2,
    });
    const level = apply([
      { type: "BOARD", seat: 1, points: 5 },
      { type: "BOARD", seat: 2, points: 5 },
    ]);
    invalidScore(() => adapter.finalize(level, context));
    const decided = adapter.applyEvent(
      level,
      { type: "BOARD", seat: 2, points: 1 },
      context,
    );
    expect(adapter.finalize(decided, context).winnerSeats).toEqual([2]);
  });

  it("caps points per board", () => {
    const { apply } = setup("CARROM_POINTS", { maxPointsPerBoard: 13 });
    invalidScore(() => apply([{ type: "BOARD", seat: 1, points: 14 }]));
  });
});

describe("MULTIPLAYER_POINTS", () => {
  const seats = [1, 2, 3, 4];

  it("ranks four players by hand totals", () => {
    const { adapter, context, apply } = setup(
      "MULTIPLAYER_POINTS",
      {},
      seats,
      false,
    );
    const score = apply([
      { type: "HAND", deltas: { "1": 2, "2": -1, "3": 1 } },
      { type: "HAND", deltas: { "4": 4 } },
    ]);
    const result = adapter.finalize(score, context);
    expect(result.placements.map((row) => [row.seat, row.placement])).toEqual([
      [4, 1],
      [1, 2],
      [3, 3],
      [2, 4],
    ]);
    expect(result.winnerSeats).toEqual([4]);
  });

  it("requires a tie-break order unless shared places are allowed", () => {
    const strict = setup("MULTIPLAYER_POINTS", {}, seats, false);
    const tied = strict.apply([{ type: "HAND", deltas: { "1": 3, "2": 3 } }]);
    invalidScore(() => strict.adapter.finalize(tied, strict.context));

    const ordered = strict.adapter.applyEvent(
      tied,
      { type: "TIEBREAK", order: [2, 1, 4, 3], previous: null },
      strict.context,
    );
    expect(
      strict.adapter.finalize(ordered, strict.context).winnerSeats,
    ).toEqual([2]);
    staleScore(() =>
      strict.adapter.applyEvent(
        ordered,
        { type: "TIEBREAK", order: [1, 2], previous: null },
        strict.context,
      ),
    );

    const shared = setup(
      "MULTIPLAYER_POINTS",
      { allowSharedPlacement: true },
      seats,
      false,
    );
    const result = shared.adapter.finalize(
      shared.apply([{ type: "HAND", deltas: { "1": 3, "2": 3 } }]),
      shared.context,
    );
    expect(result.winnerSeats).toEqual([1, 2]);
    expect(result.placements.find((row) => row.seat === 3)?.placement).toBe(3);
  });

  it("enforces non-negative totals and the target", () => {
    const { apply, adapter, context } = setup(
      "MULTIPLAYER_POINTS",
      { allowNegative: false, targetPoints: 6 },
      seats,
      false,
    );
    invalidScore(() => apply([{ type: "HAND", deltas: { "1": -1 } }]));
    invalidScore(() =>
      adapter.finalize(apply([{ type: "HAND", deltas: { "1": 5 } }]), context),
    );
  });
});

describe("SCORE_COMPARE", () => {
  it("ranks the lowest time first", () => {
    const { adapter, context, apply } = setup("SCORE_COMPARE", {
      direction: "LOWER",
      decimals: 2,
      unit: "s",
    });
    const score = apply([
      { type: "VALUE", seat: 1, value: 14.2, previous: null },
      { type: "VALUE", seat: 2, value: 12.85, previous: null },
    ]);
    const result = adapter.finalize(score, context);
    expect(result.winnerSeats).toEqual([2]);
    expect(result.displayScore).toBe("14.20 – 12.85 s");
  });

  it("refuses a value typed over someone else's entry", () => {
    const { adapter, context, apply } = setup("SCORE_COMPARE");
    const score = apply([
      { type: "VALUE", seat: 1, value: 300, previous: null },
    ]);
    staleScore(() =>
      adapter.applyEvent(
        score,
        { type: "VALUE", seat: 1, value: 310, previous: null },
        context,
      ),
    );
    expect(
      adapter.applyEvent(
        score,
        { type: "VALUE", seat: 1, value: 310, previous: 300 },
        context,
      ),
    ).toEqual({
      values: { "1": 310 },
      tiebreakOrder: null,
    });
  });

  it("rejects extra decimals, missing values and knockout ties", () => {
    const { adapter, context, apply } = setup("SCORE_COMPARE", { decimals: 1 });
    invalidScore(() =>
      apply([{ type: "VALUE", seat: 1, value: 1.25, previous: null }]),
    );
    invalidScore(() =>
      adapter.finalize(
        apply([{ type: "VALUE", seat: 1, value: 3, previous: null }]),
        context,
      ),
    );
    const tied = apply([
      { type: "VALUE", seat: 1, value: 3, previous: null },
      { type: "VALUE", seat: 2, value: 3, previous: null },
    ]);
    invalidScore(() => adapter.finalize(tied, context));
  });
});

describe("PLACEMENT_POINTS", () => {
  it("adds placement and elimination points", () => {
    const { adapter, context, apply } = setup(
      "PLACEMENT_POINTS",
      { placementPoints: [10, 6, 3], pointsPerKill: 2 },
      [1, 2, 3],
      false,
    );
    const score = apply([
      { type: "FINISH", seat: 1, finish: 1, previous: null },
      { type: "FINISH", seat: 2, finish: 2, previous: null },
      { type: "FINISH", seat: 3, finish: 3, previous: null },
      { type: "KILL", seat: 2 },
      { type: "KILL", seat: 2 },
      { type: "KILL", seat: 2 },
    ]);
    const result = adapter.finalize(score, context);
    // Seat 2: 6 + 3×2 = 12 beats seat 1's 10.
    expect(result.placements.map((row) => [row.seat, row.points])).toEqual([
      [2, 12],
      [1, 10],
      [3, 3],
    ]);
  });

  it("keeps finishing positions unique", () => {
    const { apply } = setup("PLACEMENT_POINTS", {}, [1, 2, 3], false);
    invalidScore(() =>
      apply([
        { type: "FINISH", seat: 1, finish: 1, previous: null },
        { type: "FINISH", seat: 2, finish: 1, previous: null },
      ]),
    );
  });
});

describe("rankSeats", () => {
  it("uses standard competition ranking for shared places", () => {
    const values: Record<number, number> = { 1: 5, 2: 9, 3: 5, 4: 1 };
    const placements = rankSeats({
      seats: [1, 2, 3, 4],
      value: (seat) => values[seat],
      higherIsBetter: true,
      allowShared: true,
      requiresWinner: false,
    });
    expect(placements.map((row) => [row.seat, row.placement])).toEqual([
      [2, 1],
      [1, 2],
      [3, 2],
      [4, 4],
    ]);
  });

  it("throws a scoring error for an unresolved tie", () => {
    expect(() =>
      rankSeats({
        seats: [1, 2],
        value: () => 1,
        higherIsBetter: true,
        allowShared: false,
        requiresWinner: true,
      }),
    ).toThrow(ScoringError);
  });
});
