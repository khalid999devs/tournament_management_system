import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  gameEntryStatusEnum,
  paymentStatusEnum,
  registrationStatusEnum,
} from "./enums";
import { staffProfiles } from "./staff";
import { tournamentGames, tournaments } from "./tournaments";

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    normalizedStudentId: varchar("normalized_student_id", {
      length: 64,
    }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    department: varchar("department", { length: 120 }).notNull(),
    academicYear: varchar("academic_year", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("participants_student_id_uidx").on(table.normalizedStudentId),
    index("participants_name_idx").on(table.fullName),
  ],
).enableRLS();

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    status: registrationStatusEnum("status")
      .notNull()
      .default("PENDING_REVIEW"),
    totalFeeMinor: integer("total_fee_minor").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedBy: uuid("reviewed_by").references(() => staffProfiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    internalNote: text("internal_note"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("registrations_code_uidx").on(table.tournamentId, table.code),
    uniqueIndex("registrations_idempotency_uidx").on(table.idempotencyKey),
    uniqueIndex("registrations_active_participant_uidx")
      .on(table.tournamentId, table.participantId)
      .where(sql`${table.status} in ('PENDING_REVIEW', 'CONFIRMED')`),
    index("registrations_queue_idx").on(
      table.tournamentId,
      table.status,
      table.submittedAt,
      table.id,
    ),
    index("registrations_participant_idx").on(table.participantId),
    index("registrations_reviewed_by_idx").on(table.reviewedBy),
    check(
      "registrations_fee_nonnegative_check",
      sql`${table.totalFeeMinor} >= 0`,
    ),
    check(
      "registrations_rejection_reason_check",
      sql`${table.status} <> 'REJECTED' or ${table.rejectionReason} is not null`,
    ),
  ],
).enableRLS();

export const registrationGameEntries = pgTable(
  "registration_game_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id),
    tournamentGameId: uuid("tournament_game_id")
      .notNull()
      .references(() => tournamentGames.id),
    status: gameEntryStatusEnum("status").notNull().default("PENDING"),
    seed: integer("seed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("registration_game_entries_registration_game_uidx").on(
      table.registrationId,
      table.tournamentGameId,
    ),
    index("registration_game_entries_game_status_idx").on(
      table.tournamentGameId,
      table.status,
    ),
    check(
      "registration_game_entries_seed_positive_check",
      sql`${table.seed} is null or ${table.seed} > 0`,
    ),
  ],
).enableRLS();

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id),
    provider: varchar("provider", { length: 40 }).notNull(),
    receivingAccountSnapshot: varchar("receiving_account_snapshot", {
      length: 120,
    }).notNull(),
    expectedAmountMinor: integer("expected_amount_minor").notNull(),
    transactionIdRaw: varchar("transaction_id_raw", { length: 160 }).notNull(),
    transactionIdNormalized: varchar("transaction_id_normalized", {
      length: 160,
    }).notNull(),
    status: paymentStatusEnum("status").notNull().default("SUBMITTED"),
    verifiedBy: uuid("verified_by").references(() => staffProfiles.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payments_registration_uidx").on(table.registrationId),
    uniqueIndex("payments_provider_transaction_uidx").on(
      table.provider,
      table.transactionIdNormalized,
    ),
    index("payments_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index("payments_verified_by_idx").on(table.verifiedBy),
    check(
      "payments_expected_amount_nonnegative_check",
      sql`${table.expectedAmountMinor} >= 0`,
    ),
  ],
).enableRLS();
