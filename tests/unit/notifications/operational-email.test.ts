import { describe, expect, it } from "vitest";
import { buildOperationalEmail } from "@/features/notifications/domain/operational-email";

const shared = {
  recipientName: "Student <Two>",
  tournamentName: "NDCAK Indoor Games",
  supportEmail: "ndcakofficial@gmail.com",
};

describe("operational emails", () => {
  it("renders a reminder without exposing payment details", async () => {
    const email = await buildOperationalEmail({
      ...shared,
      type: "EVENT_REMINDER",
      registrationCode: "ND26-EXAMPLE",
      schedule: "24 September, 9:00 AM",
      venue: "SWC Indoor Arena",
      checkInInstructions: "Bring a student ID.",
    });

    expect(email.text).toContain("ND26-EXAMPLE");
    expect(email.text).toContain("Bring a student ID.");
    expect(email.html).toContain("Student &lt;Two&gt;");
    expect(email.html).not.toContain("transaction ID");
  });

  it("renders a schedule change with an action", async () => {
    const email = await buildOperationalEmail({
      ...shared,
      type: "SCHEDULE_CHANGED",
      registrationCode: "ND26-EXAMPLE",
      previousSchedule: "Thursday, 9:00 AM",
      newSchedule: "Friday, 10:00 AM",
      venue: "SWC Indoor Arena",
      eventPageUrl: "https://example.com/schedule",
    });

    expect(email.html).toContain("https://example.com/schedule");
    expect(email.text).toContain("Friday, 10:00 AM");
  });

  it("rejects unsafe links", () => {
    expect(() =>
      buildOperationalEmail({
        ...shared,
        type: "OPERATOR_INVITE",
        invitationUrl: "javascript:alert(1)",
        expiresDescription: "expires tomorrow",
      }),
    ).toThrow("HTTP or HTTPS");
  });

  it("renders support and operator invitation states", async () => {
    const support = await buildOperationalEmail({
      ...shared,
      type: "SUPPORT_ACKNOWLEDGMENT",
      supportReference: "HELP-123",
      topic: "registration status",
    });
    const invitation = await buildOperationalEmail({
      ...shared,
      type: "OPERATOR_INVITE",
      invitationUrl: "https://example.com/invite",
      expiresDescription: "expires in 24 hours",
    });

    expect(support.text).toContain("HELP-123");
    expect(invitation.html).toContain("Accept invitation");
    expect(invitation.text).toContain("payment information");
  });
});
