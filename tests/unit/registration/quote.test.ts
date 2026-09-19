import { describe, expect, it } from "vitest";
import { RegistrationDomainError } from "@/features/registration/domain/errors";
import {
  calculateRegistrationQuote,
  tryRegistrationQuote,
  getRemainingCapacity,
} from "@/features/registration/domain/quote";
import type { RegistrationGameOption } from "@/features/registration/domain/types";

const games: RegistrationGameOption[] = [
  {
    id: "chess",
    name: "Chess",
    description: "Strategy",
    feeMinor: 5000,
    capacity: 8,
    reservedCount: 2,
    confirmedCount: 3,
    registrationOpen: true,
  },
  {
    id: "carrom",
    name: "Carrom",
    description: "Precision",
    feeMinor: 7000,
    capacity: 4,
    reservedCount: 1,
    confirmedCount: 3,
    registrationOpen: true,
  },
  {
    id: "closed",
    name: "Closed game",
    description: "Closed",
    feeMinor: 4000,
    capacity: 12,
    reservedCount: 0,
    confirmedCount: 0,
    registrationOpen: false,
  },
];

function captureError(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error as RegistrationDomainError;
  }

  throw new Error("Expected registration domain error.");
}

describe("registration quote", () => {
  it("subtracts pending reservations and confirmed entries from capacity", () => {
    expect(getRemainingCapacity(games[0])).toBe(3);
  });

  it("calculates the server-authoritative total", () => {
    const quote = calculateRegistrationQuote(games, ["chess"], 2);

    expect(quote.totalFeeMinor).toBe(5000);
    expect(quote.lines).toEqual([
      {
        gameId: "chess",
        name: "Chess",
        feeMinor: 5000,
        remainingCapacity: 3,
      },
    ]);
  });

  it("rejects a full game", () => {
    const error = captureError(() =>
      calculateRegistrationQuote(games, ["carrom"], 2),
    );

    expect(error.code).toBe("GAME_FULL");
    expect(error.gameId).toBe("carrom");
  });

  it("rejects closed and unknown games", () => {
    expect(
      captureError(() => calculateRegistrationQuote(games, ["closed"], 2)).code,
    ).toBe("GAME_CLOSED");
    expect(
      captureError(() => calculateRegistrationQuote(games, ["unknown"], 2))
        .code,
    ).toBe("GAME_NOT_FOUND");
  });

  it("enforces selection count and uniqueness", () => {
    expect(
      captureError(() => calculateRegistrationQuote(games, [], 2)).code,
    ).toBe("NO_GAMES_SELECTED");
    expect(
      captureError(() =>
        calculateRegistrationQuote(games, ["chess", "chess"], 2),
      ).code,
    ).toBe("DUPLICATE_GAME");
    expect(
      captureError(() =>
        calculateRegistrationQuote(games, ["chess", "closed", "carrom"], 2),
      ).code,
    ).toBe("TOO_MANY_GAMES");
  });

  it("reports a game that filled up instead of throwing", () => {
    expect(tryRegistrationQuote(games, ["carrom"], 2)).toEqual({
      ok: false,
      message: expect.stringContaining("no remaining capacity"),
    });
    expect(tryRegistrationQuote(games, ["chess"], 2)).toMatchObject({
      ok: true,
    });
  });
});
