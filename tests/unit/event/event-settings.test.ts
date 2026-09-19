import { describe, expect, it } from "vitest";
import {
  dateToDhakaInput,
  dhakaInputToDate,
  evaluateReadiness,
  eventDetailsSchema,
  isReadyToOpen,
  nextStatuses,
  slugify,
  toGameAvailability,
  toGameStatus,
  type ReadinessState,
} from "@/features/event/domain/event-settings";

const validDetails = {
  name: "NDCAK Indoor Games Championship",
  year: "2026",
  venue: "KUET Campus",
  description: "",
  checkInInstructions: "",
  startsAt: "2026-11-05T09:00",
  endsAt: "2026-11-07T18:00",
  registrationOpenAt: "",
  registrationCloseAt: "2026-10-30T23:59",
  maxGamesPerParticipant: "3",
  departments: "Civil Engineering\nMechanical Engineering\n",
  academicYears: "1st year\n2nd year",
  resultsEnabled: false,
};

const readyState: ReadinessState = {
  now: new Date("2026-10-01T00:00:00Z"),
  venue: "KUET Campus",
  startsAt: new Date("2026-11-05T03:00:00Z"),
  endsAt: new Date("2026-11-07T12:00:00Z"),
  registrationCloseAt: new Date("2026-10-30T17:59:00Z"),
  checkInInstructions: "Bring your student ID.",
  games: [{ availability: "OPEN", feeMinor: 5000 }],
  enabledPaymentMethods: 1,
};

describe("Dhaka time conversion", () => {
  it("treats staff input as Bangladesh time", () => {
    expect(dhakaInputToDate("2026-11-05T09:00")?.toISOString()).toBe(
      "2026-11-05T03:00:00.000Z",
    );
  });

  it("round-trips back to the input format", () => {
    expect(dateToDhakaInput(new Date("2026-11-05T03:00:00Z"))).toBe(
      "2026-11-05T09:00",
    );
    expect(dateToDhakaInput(null)).toBe("");
  });

  it("rejects malformed values", () => {
    expect(dhakaInputToDate("05/11/2026 09:00")).toBeNull();
    expect(dhakaInputToDate("2026-13-45T99:00")).toBeNull();
  });
});

describe("event details validation", () => {
  it("parses lists and empty optional fields", () => {
    const parsed = eventDetailsSchema.parse(validDetails);

    expect(parsed.departments).toEqual([
      "Civil Engineering",
      "Mechanical Engineering",
    ]);
    expect(parsed.description).toBeNull();
    expect(parsed.registrationOpenAt).toBeNull();
    expect(parsed.maxGamesPerParticipant).toBe(3);
  });

  it("rejects an event that ends before it starts", () => {
    const result = eventDetailsSchema.safeParse({
      ...validDetails,
      endsAt: "2026-11-04T09:00",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endsAt"]);
  });

  it("rejects a registration window that closes before it opens", () => {
    const result = eventDetailsSchema.safeParse({
      ...validDetails,
      registrationOpenAt: "2026-10-31T00:00",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["registrationCloseAt"]);
  });

  it("rejects duplicate or empty option lists", () => {
    expect(
      eventDetailsSchema.safeParse({
        ...validDetails,
        departments: "Civil\nCivil",
      }).success,
    ).toBe(false);
    expect(
      eventDetailsSchema.safeParse({ ...validDetails, academicYears: " \n " })
        .success,
    ).toBe(false);
  });
});

describe("registration readiness", () => {
  it("is ready when every required item is complete", () => {
    expect(isReadyToOpen(evaluateReadiness(readyState))).toBe(true);
  });

  it("does not block on the recommended check-in instructions", () => {
    const checks = evaluateReadiness({
      ...readyState,
      checkInInstructions: null,
    });

    expect(checks.find((check) => check.key === "checkin")?.ok).toBe(false);
    expect(isReadyToOpen(checks)).toBe(true);
  });

  it("requires an open game and a payment method for paid games", () => {
    expect(
      isReadyToOpen(
        evaluateReadiness({
          ...readyState,
          games: [{ availability: "DRAFT", feeMinor: 5000 }],
        }),
      ),
    ).toBe(false);
    expect(
      isReadyToOpen(
        evaluateReadiness({ ...readyState, enabledPaymentMethods: 0 }),
      ),
    ).toBe(false);
    expect(
      isReadyToOpen(
        evaluateReadiness({
          ...readyState,
          enabledPaymentMethods: 0,
          games: [{ availability: "OPEN", feeMinor: 0 }],
        }),
      ),
    ).toBe(true);
  });

  it("requires a closing time that is still ahead", () => {
    expect(
      isReadyToOpen(
        evaluateReadiness({
          ...readyState,
          now: new Date("2026-10-31T00:00:00Z"),
        }),
      ),
    ).toBe(false);
  });
});

describe("status and availability rules", () => {
  it("only allows forward tournament transitions plus reopening", () => {
    expect(nextStatuses("DRAFT")).toEqual(["REGISTRATION_OPEN"]);
    expect(nextStatuses("REGISTRATION_CLOSED")).toContain("REGISTRATION_OPEN");
    expect(nextStatuses("ARCHIVED")).toEqual([]);
  });

  it("keeps game status and the registration flag in step", () => {
    expect(toGameStatus("OPEN")).toEqual({
      status: "REGISTRATION_OPEN",
      registrationOpen: true,
    });
    expect(toGameAvailability("REGISTRATION_OPEN", false)).toBe("CLOSED");
    expect(toGameAvailability("DRAFT", false)).toBe("DRAFT");
  });

  it("builds URL-safe slugs", () => {
    expect(slugify("NDCAK Indoor Games 2026!")).toBe("ndcak-indoor-games-2026");
  });
});
