export type RegistrationErrorCode =
  | "NO_GAMES_SELECTED"
  | "TOO_MANY_GAMES"
  | "GAME_NOT_FOUND"
  | "GAME_CLOSED"
  | "GAME_FULL"
  | "DUPLICATE_GAME";

export class RegistrationDomainError extends Error {
  constructor(
    readonly code: RegistrationErrorCode,
    message: string,
    readonly gameId?: string,
  ) {
    super(message);
    this.name = "RegistrationDomainError";
  }
}
