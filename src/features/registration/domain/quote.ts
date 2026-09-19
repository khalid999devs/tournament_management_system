import { RegistrationDomainError } from "./errors";
import type {
  RegistrationGameOption,
  RegistrationQuote,
  RegistrationQuoteLine,
} from "./types";

export function getRemainingCapacity(game: RegistrationGameOption) {
  return Math.max(0, game.capacity - game.reservedCount - game.confirmedCount);
}

export function calculateRegistrationQuote(
  games: RegistrationGameOption[],
  selectedGameIds: string[],
  maxGames: number,
): RegistrationQuote {
  if (selectedGameIds.length === 0) {
    throw new RegistrationDomainError(
      "NO_GAMES_SELECTED",
      "Select at least one game.",
    );
  }

  if (selectedGameIds.length > maxGames) {
    throw new RegistrationDomainError(
      "TOO_MANY_GAMES",
      `Select no more than ${maxGames} games.`,
    );
  }

  const uniqueIds = new Set(selectedGameIds);

  if (uniqueIds.size !== selectedGameIds.length) {
    throw new RegistrationDomainError(
      "DUPLICATE_GAME",
      "Each game can be selected only once.",
    );
  }

  const gamesById = new Map(games.map((game) => [game.id, game]));
  const lines: RegistrationQuoteLine[] = selectedGameIds.map((gameId) => {
    const game = gamesById.get(gameId);

    if (!game) {
      throw new RegistrationDomainError(
        "GAME_NOT_FOUND",
        "A selected game is no longer available.",
        gameId,
      );
    }

    if (!game.registrationOpen) {
      throw new RegistrationDomainError(
        "GAME_CLOSED",
        `${game.name} is not open for registration.`,
        gameId,
      );
    }

    const remainingCapacity = getRemainingCapacity(game);

    if (remainingCapacity === 0) {
      throw new RegistrationDomainError(
        "GAME_FULL",
        `${game.name} has no remaining capacity.`,
        gameId,
      );
    }

    return {
      gameId,
      name: game.name,
      feeMinor: game.feeMinor,
      remainingCapacity,
    };
  });

  return {
    lines,
    totalFeeMinor: lines.reduce((total, line) => total + line.feeMinor, 0),
  };
}

// For screens that must not crash when availability changes under them, for
// example when another student takes the last place while this one pays.
export function tryRegistrationQuote(
  games: RegistrationGameOption[],
  selectedGameIds: string[],
  maxGames: number,
): { ok: true; quote: RegistrationQuote } | { ok: false; message: string } {
  try {
    return {
      ok: true,
      quote: calculateRegistrationQuote(games, selectedGameIds, maxGames),
    };
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
