import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  describeIssueCategory,
  issueReportSchema,
} from "@/features/issues/domain/issues";

const valid = {
  matchId: randomUUID(),
  category: "NO_SHOW",
  message: "Seat 2 did not arrive",
  clientRequestId: randomUUID(),
};

describe("problem reports", () => {
  it("accepts a match report and a general report", () => {
    expect(issueReportSchema.safeParse(valid).success).toBe(true);
    expect(
      issueReportSchema.safeParse({ ...valid, matchId: null }).success,
    ).toBe(true);
  });

  it("explains what is missing in plain words", () => {
    const short = issueReportSchema.safeParse({ ...valid, message: " hi " });
    expect(short.error?.issues[0]?.message).toBe(
      "Describe the problem in a few words.",
    );
    const noCategory = issueReportSchema.safeParse({
      ...valid,
      category: "",
    });
    expect(noCategory.error?.issues[0]?.message).toBe(
      "Choose what kind of problem.",
    );
  });

  it("needs a request id so a resent report lands once", () => {
    expect(
      issueReportSchema.safeParse({ ...valid, clientRequestId: "x" }).success,
    ).toBe(false);
  });

  it("labels categories for people", () => {
    expect(describeIssueCategory("EQUIPMENT")).toBe(
      "Equipment or table problem",
    );
    expect(describeIssueCategory("UNKNOWN")).toBe("Problem");
  });
});
