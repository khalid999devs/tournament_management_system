import { describe, expect, it } from "vitest";
import {
  canOperatorAccessMatch,
  type EffectiveAssignment,
  type MatchScope,
} from "@/features/operators/domain/authorization";

const match: MatchScope = {
  tournamentId: "tournament-a",
  tournamentGameId: "game-a",
  roundId: "round-a",
  matchId: "match-a",
  participantEntryIds: ["entry-a", "entry-b"],
};

function grant(
  scopeType: EffectiveAssignment["scopeType"],
  targetId: string | null,
  overrides: Partial<EffectiveAssignment> = {},
): EffectiveAssignment {
  return {
    active: true,
    tournamentId: match.tournamentId,
    scopeType,
    targetId,
    capabilities: ["VIEW"],
    ...overrides,
  };
}

describe("operator match authorization", () => {
  it.each([
    ["ALL_TOURNAMENT", null],
    ["GAME", "game-a"],
    ["ROUND", "round-a"],
    ["MATCH", "match-a"],
    ["PARTICIPANT_ENTRY", "entry-b"],
  ] as const)("allows a matching %s scope", (scope, target) => {
    expect(
      canOperatorAccessMatch(true, [grant(scope, target)], match, "VIEW"),
    ).toBe(true);
  });

  it("unions grants without broadening an unrelated target", () => {
    expect(
      canOperatorAccessMatch(
        true,
        [grant("GAME", "game-b"), grant("MATCH", "match-a")],
        match,
        "VIEW",
      ),
    ).toBe(true);
    expect(
      canOperatorAccessMatch(
        true,
        [grant("GAME", "game-b"), grant("MATCH", "match-b")],
        match,
        "VIEW",
      ),
    ).toBe(false);
  });

  it("denies inactive operators and revoked assignments", () => {
    expect(
      canOperatorAccessMatch(
        false,
        [grant("ALL_TOURNAMENT", null)],
        match,
        "VIEW",
      ),
    ).toBe(false);
    expect(
      canOperatorAccessMatch(
        true,
        [grant("ALL_TOURNAMENT", null, { active: false })],
        match,
        "VIEW",
      ),
    ).toBe(false);
    expect(
      canOperatorAccessMatch(
        true,
        [
          grant("MATCH", "match-a", { active: false }),
          grant("MATCH", "match-b"),
        ],
        match,
        "VIEW",
      ),
    ).toBe(false);
  });

  it("denies a different tournament or missing capability", () => {
    expect(
      canOperatorAccessMatch(
        true,
        [grant("ALL_TOURNAMENT", null, { tournamentId: "tournament-b" })],
        match,
        "VIEW",
      ),
    ).toBe(false);
    expect(
      canOperatorAccessMatch(
        true,
        [grant("MATCH", "match-a")],
        match,
        "SCORE_UPDATE",
      ),
    ).toBe(false);
    expect(
      canOperatorAccessMatch(
        true,
        [grant("PARTICIPANT_ENTRY", "entry-c")],
        match,
        "VIEW",
      ),
    ).toBe(false);
  });
});
