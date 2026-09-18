import { describe, expect, it } from "vitest";
import { createCalendarInvitation } from "@/features/notifications/domain/calendar";

describe("calendar invitations", () => {
  it("creates a UTC calendar event with escaped participant-safe text", () => {
    const invitation = createCalendarInvitation({
      uid: "registration-1@ndcak",
      title: "NDCAK Games, 2026",
      description: "Chess; Carrom",
      location: "KUET\nArena",
      startsAt: new Date("2026-09-24T03:00:00.000Z"),
      endsAt: new Date("2026-09-26T12:00:00.000Z"),
      organizerEmail: "ndcakofficial@gmail.com",
    });

    expect(invitation).toContain("DTSTART:20260924T030000Z");
    expect(invitation).toContain("DTEND:20260926T120000Z");
    expect(invitation).toContain("SUMMARY:NDCAK Games\\, 2026");
    expect(invitation).toContain("DESCRIPTION:Chess\\; Carrom");
    expect(invitation).toContain("LOCATION:KUET\\nArena");
    expect(invitation.endsWith("\r\n")).toBe(true);
  });
});
