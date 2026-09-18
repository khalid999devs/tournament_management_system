import { describe, expect, it } from "vitest";
import { planRegistrationReview } from "@/features/registration/domain/review";

describe("registration review planning", () => {
  it("moves a pending reservation into confirmed capacity", () => {
    expect(planRegistrationReview("PENDING_REVIEW", "APPROVE")).toEqual({
      registrationStatus: "CONFIRMED",
      entryStatus: "CONFIRMED",
      paymentStatus: "VERIFIED",
      reservedDelta: -1,
      confirmedDelta: 1,
    });
  });

  it("releases reserved capacity on rejection", () => {
    expect(planRegistrationReview("PENDING_REVIEW", "REJECT")).toEqual({
      registrationStatus: "REJECTED",
      entryStatus: "REJECTED",
      paymentStatus: "REJECTED",
      reservedDelta: -1,
      confirmedDelta: 0,
    });
  });

  it("is idempotent for an already-applied decision", () => {
    expect(planRegistrationReview("CONFIRMED", "APPROVE")).toBeNull();
    expect(planRegistrationReview("REJECTED", "REJECT")).toBeNull();
  });

  it("blocks a conflicting second decision", () => {
    expect(() => planRegistrationReview("CONFIRMED", "REJECT")).toThrow(
      "ALREADY_REVIEWED",
    );
    expect(() => planRegistrationReview("CANCELLED", "APPROVE")).toThrow(
      "ALREADY_REVIEWED",
    );
  });
});
