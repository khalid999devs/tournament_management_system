import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { matchOutcomeEnum, matchStatusEnum, roundStatusEnum } from "./enums";
import { registrationGameEntries } from "./registrations";
import { staffProfiles } from "./staff";
import { tournamentGames } from "./tournaments";

export type RoundMetadata = Record<string, unknown>;
export type MatchResultData = Record<string, unknown>;
export type MatchEntryResultData = Record<string, unknown>;
export type MatchUpdatePayload = Record<string, unknown>;
export type MatchScoreData = unknown;

export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentGameId: uuid("tournament_game_id")
      .notNull()
      .references(() => tournamentGames.id),
    name: varchar("name", { length: 120 }).notNull(),
    sequence: integer("sequence").notNull(),
    status: roundStatusEnum("status").notNull().default("DRAFT"),
    metadata: jsonb("metadata").$type<RoundMetadata>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("rounds_game_sequence_uidx").on(
      table.tournamentGameId,
      table.sequence,
    ),
    check("rounds_sequence_positive_check", sql`${table.sequence} > 0`),
  ],
).enableRLS();

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id),
    code: varchar("code", { length: 48 }).notNull(),
    status: matchStatusEnum("status").notNull().default("SCHEDULED"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    venue: varchar("venue", { length: 180 }),
    station: varchar("station", { length: 80 }),
    displayScore: varchar("display_score", { length: 160 }),
    // Live score derived from match_updates by the game's scoring adapter.
    scoreData: jsonb("score_json").$type<MatchScoreData>(),
    resultData: jsonb("result_json").$type<MatchResultData>(),
    version: integer("version").notNull().default(1),
    nextMatchId: uuid("next_match_id"),
    nextMatchSeat: integer("next_match_seat"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("matches_round_code_uidx").on(table.roundId, table.code),
    index("matches_round_status_schedule_idx").on(
      table.roundId,
      table.status,
      table.scheduledAt,
      table.id,
    ),
    index("matches_next_match_idx").on(table.nextMatchId),
    check("matches_version_positive_check", sql`${table.version} > 0`),
    check(
      "matches_next_seat_positive_check",
      sql`${table.nextMatchSeat} is null or ${table.nextMatchSeat} > 0`,
    ),
    foreignKey({
      columns: [table.nextMatchId],
      foreignColumns: [table.id],
      name: "matches_next_match_id_fk",
    }),
  ],
).enableRLS();

export const matchEntries = pgTable(
  "match_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    registrationGameEntryId: uuid("registration_game_entry_id")
      .notNull()
      .references(() => registrationGameEntries.id),
    seat: integer("seat").notNull(),
    placement: integer("placement"),
    points: integer("points"),
    outcome: matchOutcomeEnum("outcome"),
    resultData: jsonb("result_json")
      .$type<MatchEntryResultData>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("match_entries_match_registration_entry_uidx").on(
      table.matchId,
      table.registrationGameEntryId,
    ),
    uniqueIndex("match_entries_match_seat_uidx").on(table.matchId, table.seat),
    index("match_entries_registration_entry_idx").on(
      table.registrationGameEntryId,
    ),
    check("match_entries_seat_positive_check", sql`${table.seat} > 0`),
    check(
      "match_entries_placement_positive_check",
      sql`${table.placement} is null or ${table.placement} > 0`,
    ),
  ],
).enableRLS();

// Append-only log of every accepted change to a match. match_version is the
// per-match sequence number; client_event_id makes retried submissions
// idempotent; device_time is when the operator acted, kept for review only.
export const matchUpdates = pgTable(
  "match_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    actorStaffId: uuid("actor_staff_id")
      .notNull()
      .references(() => staffProfiles.id),
    updateType: varchar("update_type", { length: 80 }).notNull(),
    matchVersion: integer("match_version").notNull(),
    payload: jsonb("payload_json").$type<MatchUpdatePayload>().notNull(),
    clientEventId: uuid("client_event_id").notNull(),
    deviceTime: timestamp("device_time", { withTimezone: true }),
    voidsUpdateId: uuid("voids_update_id"),
    // clock_timestamp() so updates committed in one transaction keep
    // distinct, real times.
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("match_updates_match_version_uidx").on(
      table.matchId,
      table.matchVersion,
    ),
    uniqueIndex("match_updates_client_event_uidx").on(table.clientEventId),
    uniqueIndex("match_updates_voids_update_uidx").on(table.voidsUpdateId),
    index("match_updates_match_created_idx").on(
      table.matchId,
      table.createdAt,
      table.id,
    ),
    index("match_updates_actor_created_idx").on(
      table.actorStaffId,
      table.createdAt,
      table.id,
    ),
    check(
      "match_updates_version_positive_check",
      sql`${table.matchVersion} > 0`,
    ),
    foreignKey({
      columns: [table.voidsUpdateId],
      foreignColumns: [table.id],
      name: "match_updates_voids_update_id_fk",
    }),
  ],
).enableRLS();
