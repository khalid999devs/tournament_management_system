import { z } from "zod";
import {
  scoringAdapterKeys,
  scoringAdapterList,
  type ScoringAdapterKey,
} from "@/features/scoring/adapters";

export type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type GameAvailability = "DRAFT" | "OPEN" | "CLOSED";

// Adapter keys are stored on each tournament game; the adapters themselves
// live in src/features/scoring.
export const scoringAdapters = scoringAdapterList.map((adapter) => ({
  key: adapter.key,
  label: `${adapter.label}: ${adapter.examples}`,
  progression: adapter.defaultProgression,
}));

export type { ScoringAdapterKey };

export const defaultDepartments = [
  "Architecture",
  "Building Engineering and Construction Management",
  "Chemical Engineering",
  "Civil Engineering",
  "Computer Science and Engineering",
  "Electrical and Electronic Engineering",
  "Electronics and Communication Engineering",
  "Energy Science and Engineering",
  "Industrial Engineering and Management",
  "Leather Engineering",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Textile Engineering",
  "Urban and Regional Planning",
];

export const defaultAcademicYears = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year",
  "5th year",
];

// Bangladesh has not observed daylight saving since 2009, so event times
// entered by staff convert to UTC with a fixed offset.
const dhakaOffset = "+06:00";

export function dhakaInputToDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${dhakaOffset}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateToDhakaInput(date: Date | string | null) {
  if (!date) return "";
  const shifted = new Date(new Date(date).getTime() + 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalDhakaTime = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return null;
    const date = dhakaInputToDate(value);
    if (!date) {
      context.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

const lineList = (max: number) =>
  z
    .string()
    .transform((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(max))
        .min(1, "Add at least one option.")
        .max(60)
        .refine((items) => new Set(items).size === items.length, {
          message: "Remove duplicate options.",
        }),
    );

export const eventDetailsSchema = z
  .object({
    name: z.string().trim().min(3).max(180),
    year: z.coerce.number().int().min(2020).max(2100),
    venue: optionalText(240),
    description: optionalText(600),
    checkInInstructions: optionalText(600),
    startsAt: optionalDhakaTime,
    endsAt: optionalDhakaTime,
    registrationOpenAt: optionalDhakaTime,
    registrationCloseAt: optionalDhakaTime,
    maxGamesPerParticipant: z.coerce.number().int().min(1).max(20),
    departments: lineList(120),
    academicYears: lineList(40),
    resultsEnabled: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.startsAt && value.endsAt && value.endsAt < value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The event must end after it starts.",
      });
    }
    if (
      value.registrationOpenAt &&
      value.registrationCloseAt &&
      value.registrationCloseAt <= value.registrationOpenAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["registrationCloseAt"],
        message: "Registration must close after it opens.",
      });
    }
  });

export type EventDetailsInput = z.infer<typeof eventDetailsSchema>;

export const tournamentGameSchema = z.object({
  description: optionalText(300),
  feeTaka: z.coerce.number().int().min(0).max(100000),
  capacity: z.coerce.number().int().min(1).max(10000),
  availability: z.enum(["DRAFT", "OPEN", "CLOSED"]),
  rules: optionalText(8000),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export type TournamentGameInput = z.infer<typeof tournamentGameSchema>;

export const scoringRulesSchema = z.object({
  scoringAdapter: z.enum(scoringAdapterKeys),
  progressionMode: z.enum(["AUTOMATIC_SINGLE_ELIMINATION", "MANUAL"]),
});

export const newTournamentGameSchema = z.object({
  name: z.string().trim().min(2).max(120),
  scoringAdapter: z.enum(scoringAdapterKeys),
  feeTaka: z.coerce.number().int().min(0).max(100000),
  capacity: z.coerce.number().int().min(1).max(10000),
});

export const paymentMethodSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  receivingAccount: z.string().trim().min(4).max(120),
  instructions: optionalText(1000),
  enabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export function toGameStatus(availability: GameAvailability) {
  if (availability === "OPEN") {
    return { status: "REGISTRATION_OPEN" as const, registrationOpen: true };
  }
  if (availability === "CLOSED") {
    return { status: "REGISTRATION_CLOSED" as const, registrationOpen: false };
  }
  return { status: "DRAFT" as const, registrationOpen: false };
}

export function toGameAvailability(
  status: string,
  registrationOpen: boolean,
): GameAvailability {
  if (status === "REGISTRATION_OPEN" && registrationOpen) return "OPEN";
  if (status === "DRAFT") return "DRAFT";
  return "CLOSED";
}

const statusTransitions: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: ["REGISTRATION_OPEN"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED"],
  REGISTRATION_CLOSED: ["REGISTRATION_OPEN", "IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function nextStatuses(status: TournamentStatus) {
  return statusTransitions[status];
}

export type ReadinessState = {
  now: Date;
  venue: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  registrationCloseAt: Date | null;
  checkInInstructions: string | null;
  games: { availability: GameAvailability; feeMinor: number }[];
  enabledPaymentMethods: number;
};

export type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
};

export function evaluateReadiness(state: ReadinessState): ReadinessCheck[] {
  const openGames = state.games.filter((game) => game.availability === "OPEN");
  const needsPayment = openGames.some((game) => game.feeMinor > 0);

  return [
    {
      key: "dates",
      label: "Event start and end times are set",
      ok: Boolean(state.startsAt && state.endsAt),
      required: true,
    },
    {
      key: "venue",
      label: "Venue is set",
      ok: Boolean(state.venue),
      required: true,
    },
    {
      key: "closing",
      label: "Registration closing time is set and still ahead",
      ok: Boolean(
        state.registrationCloseAt && state.registrationCloseAt > state.now,
      ),
      required: true,
    },
    {
      key: "games",
      label: "At least one game is open for registration",
      ok: openGames.length > 0,
      required: true,
    },
    {
      key: "payment",
      label: "An enabled payment method exists for paid games",
      ok: !needsPayment || state.enabledPaymentMethods > 0,
      required: true,
    },
    {
      key: "checkin",
      label: "Check-in instructions are written for the confirmation email",
      ok: Boolean(state.checkInInstructions),
      required: false,
    },
  ];
}

export function isReadyToOpen(checks: ReadinessCheck[]) {
  return checks.every((check) => check.ok || !check.required);
}
