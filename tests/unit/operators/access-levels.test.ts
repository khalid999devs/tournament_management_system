import { describe, expect, it } from "vitest";
import {
  accessLevels,
  capabilitiesForLevel,
  defaultAccessLevel,
  describeCapabilities,
} from "@/features/operators/domain/access-levels";

describe("operator access levels", () => {
  it("always includes viewing and reporting a problem", () => {
    for (const level of accessLevels) {
      expect(level.capabilities).toContain("VIEW");
      expect(level.capabilities).toContain("ISSUE_REPORT");
    }
  });

  it("only lets the top level confirm a result", () => {
    const confirming = accessLevels.filter((level) =>
      level.capabilities.includes("FINALIZE_MATCH"),
    );
    expect(confirming.map((level) => level.value)).toEqual([
      "SCORE_AND_CONFIRM",
    ]);
  });

  it("gives watch-only no way to change a score", () => {
    expect(capabilitiesForLevel("WATCH")).not.toContain("SCORE_UPDATE");
    expect(capabilitiesForLevel("WATCH")).not.toContain("FINALIZE_MATCH");
  });

  it("starts an admin on full scoring", () => {
    expect(capabilitiesForLevel(defaultAccessLevel)).toEqual([
      "VIEW",
      "SCORE_UPDATE",
      "FINALIZE_MATCH",
      "ISSUE_REPORT",
    ]);
  });

  it("names a level whatever order its capabilities arrive in", () => {
    expect(describeCapabilities(["SCORE_UPDATE", "VIEW", "ISSUE_REPORT"])).toBe(
      "Score only",
    );
  });

  it("lists capabilities that match no level", () => {
    expect(describeCapabilities(["VIEW", "FINALIZE_MATCH"])).toBe(
      "View · Confirm results",
    );
    expect(describeCapabilities([])).toBe("No access");
  });
});
