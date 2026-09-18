import { describe, expect, it } from "vitest";
import { buildRegistrationEmail } from "@/features/notifications/domain/registration-email";

const baseInput = {
  registrationId: "00000000-0000-4000-8000-000000000001",
  registrationCode: "ND26-ABCDEF1234",
  participantName: "Student <One>",
  recipientEmail: "student@example.com",
  tournamentName: "NDCAK Indoor Games",
  tournamentSlug: "ndcak-indoor-games",
  timezone: "Asia/Dhaka",
  venue: "SWC Indoor Arena",
  startsAt: new Date("2026-09-24T03:00:00.000Z"),
  endsAt: new Date("2026-09-26T12:00:00.000Z"),
  checkInInstructions: "Bring student ID.",
  rejectionReason: null,
  gameNames: ["Chess", "Carrom"],
  organizerEmail: "ndcakofficial@gmail.com",
};

describe("registration emails", () => {
  it("uses pending wording and omits calendar data for submission", () => {
    const email = buildRegistrationEmail({
      ...baseInput,
      type: "REGISTRATION_SUBMITTED",
    });

    expect(email.text).toContain("pending manual payment review");
    expect(email.text).toContain("not confirmed yet");
    expect(email.attachments).toBeUndefined();
    expect(email.html).toContain("Student &lt;One&gt;");
  });

  it("attaches an ICS file only after approval", () => {
    const email = buildRegistrationEmail({
      ...baseInput,
      type: "REGISTRATION_APPROVED",
    });

    expect(email.text).toContain("is confirmed");
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments?.[0].filename).toBe("ndcak-indoor-games.ics");
  });

  it("requires configured event dates for approval mail", () => {
    expect(() =>
      buildRegistrationEmail({
        ...baseInput,
        type: "REGISTRATION_APPROVED",
        startsAt: null,
      }),
    ).toThrow("requires event start");
  });
});
