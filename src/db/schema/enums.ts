import { pgEnum } from "drizzle-orm/pg-core";

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
]);

export const tournamentGameStatusEnum = pgEnum("tournament_game_status", [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
]);

export const progressionModeEnum = pgEnum("progression_mode", [
  "AUTOMATIC_SINGLE_ELIMINATION",
  "MANUAL",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "PENDING_REVIEW",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
]);

export const gameEntryStatusEnum = pgEnum("game_entry_status", [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
  "REFUNDED",
]);

export const staffRoleEnum = pgEnum("staff_role", [
  "SUPER_ADMIN",
  "SCORE_OPERATOR",
]);

export const assignmentScopeEnum = pgEnum("assignment_scope", [
  "ALL_TOURNAMENT",
  "GAME",
  "ROUND",
  "MATCH",
  "PARTICIPANT_ENTRY",
]);

export const roundStatusEnum = pgEnum("round_status", [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "WALKOVER",
  "POSTPONED",
  "CANCELLED",
]);

export const matchOutcomeEnum = pgEnum("match_outcome", [
  "WIN",
  "LOSS",
  "DRAW",
  "DQ",
  "DNS",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "REGISTRATION_SUBMITTED",
  "REGISTRATION_APPROVED",
  "REGISTRATION_REJECTED",
  "EVENT_REMINDER",
  "SCHEDULE_CHANGED",
  "OPERATOR_INVITE",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "QUEUED",
  "SENDING",
  "SENT",
  "FAILED",
]);

export const issueStatusEnum = pgEnum("issue_status", ["OPEN", "RESOLVED"]);
