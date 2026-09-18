export type RegistrationGameOption = {
  id: string;
  name: string;
  description: string;
  feeMinor: number;
  capacity: number;
  reservedCount: number;
  confirmedCount: number;
  registrationOpen: boolean;
};

export type RegistrationQuoteLine = {
  gameId: string;
  name: string;
  feeMinor: number;
  remainingCapacity: number;
};

export type RegistrationQuote = {
  lines: RegistrationQuoteLine[];
  totalFeeMinor: number;
};

export type RegistrationTournament = {
  id: string;
  name: string;
  venue: string | null;
  maxGamesPerParticipant: number;
  games: RegistrationGameOption[];
};

export type RegistrationPaymentMethod = {
  provider: string;
  displayName: string;
  receivingAccount: string;
  instructions: string | null;
};

export type RegistrationCheckout = RegistrationTournament & {
  paymentMethods: RegistrationPaymentMethod[];
};
