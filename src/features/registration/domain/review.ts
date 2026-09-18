export type ReviewDecision = "APPROVE" | "REJECT";

export type ReviewPlan = {
  registrationStatus: "CONFIRMED" | "REJECTED";
  entryStatus: "CONFIRMED" | "REJECTED";
  paymentStatus: "VERIFIED" | "REJECTED";
  reservedDelta: -1;
  confirmedDelta: 0 | 1;
};

export function planRegistrationReview(
  currentStatus: "PENDING_REVIEW" | "CONFIRMED" | "REJECTED" | "CANCELLED",
  decision: ReviewDecision,
): ReviewPlan | null {
  const target = decision === "APPROVE" ? "CONFIRMED" : "REJECTED";

  if (currentStatus === target) return null;

  if (currentStatus !== "PENDING_REVIEW") {
    throw new Error("ALREADY_REVIEWED");
  }

  if (decision === "APPROVE") {
    return {
      registrationStatus: "CONFIRMED",
      entryStatus: "CONFIRMED",
      paymentStatus: "VERIFIED",
      reservedDelta: -1,
      confirmedDelta: 1,
    };
  }

  return {
    registrationStatus: "REJECTED",
    entryStatus: "REJECTED",
    paymentStatus: "REJECTED",
    reservedDelta: -1,
    confirmedDelta: 0,
  };
}
