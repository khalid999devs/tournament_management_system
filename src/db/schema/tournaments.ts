import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  progressionModeEnum,
  tournamentGameStatusEnum,
  tournamentStatusEnum,
} from "./enums";

export type TournamentPublicSettings = {
  description?: string;
  checkInInstructions?: string;
  resultsEnabled: boolean;
  publicCapacityEnabled: boolean;
};

export type TournamentGameConfig = Record<string, unknown>;

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    year: integer("year").notNull(),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Asia/Dhaka"),
    venue: varchar("venue", { length: 240 }),
    registrationOpenAt: timestamp("registration_open_at", {
      withTimezone: true,
    }),
    registrationCloseAt: timestamp("registration_close_at", {
      withTimezone: true,
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    maxGamesPerParticipant: integer("max_games_per_participant")
      .notNull()
      .default(1),
    status: tournamentStatusEnum("status").notNull().default("DRAFT"),
    publicSettings: jsonb("public_settings")
      .$type<TournamentPublicSettings>()
      .notNull()
      .default({ resultsEnabled: false, publicCapacityEnabled: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tournaments_slug_uidx").on(table.slug),
    check(
      "tournaments_max_games_positive_check",
      sql`${table.maxGamesPerParticipant} > 0`,
    ),
    check(
      "tournaments_registration_window_check",
      sql`${table.registrationCloseAt} is null or ${table.registrationOpenAt} is null or ${table.registrationCloseAt} > ${table.registrationOpenAt}`,
    ),
    check(
      "tournaments_event_window_check",
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
).enableRLS();

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    iconKey: varchar("icon_key", { length: 80 }),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("games_slug_uidx").on(table.slug),
    uniqueIndex("games_name_uidx").on(table.name),
  ],
).enableRLS();

export const tournamentGames = pgTable(
  "tournament_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    feeMinor: integer("fee_minor").notNull().default(0),
    capacity: integer("capacity").notNull(),
    reservedCount: integer("reserved_count").notNull().default(0),
    confirmedCount: integer("confirmed_count").notNull().default(0),
    status: tournamentGameStatusEnum("status").notNull().default("DRAFT"),
    registrationOpen: boolean("registration_open").notNull().default(false),
    scoringAdapter: varchar("scoring_adapter", { length: 80 }).notNull(),
    progressionMode: progressionModeEnum("progression_mode")
      .notNull()
      .default("MANUAL"),
    rules: text("rules"),
    config: jsonb("config_json")
      .$type<TournamentGameConfig>()
      .notNull()
      .default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tournament_games_tournament_game_uidx").on(
      table.tournamentId,
      table.gameId,
    ),
    index("tournament_games_registration_idx").on(
      table.tournamentId,
      table.status,
      table.registrationOpen,
    ),
    index("tournament_games_game_idx").on(table.gameId),
    check(
      "tournament_games_fee_nonnegative_check",
      sql`${table.feeMinor} >= 0`,
    ),
    check(
      "tournament_games_capacity_positive_check",
      sql`${table.capacity} > 0`,
    ),
    check(
      "tournament_games_counts_nonnegative_check",
      sql`${table.reservedCount} >= 0 and ${table.confirmedCount} >= 0`,
    ),
    check(
      "tournament_games_capacity_limit_check",
      sql`${table.reservedCount} + ${table.confirmedCount} <= ${table.capacity}`,
    ),
  ],
).enableRLS();

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    provider: varchar("provider", { length: 40 }).notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    receivingAccount: varchar("receiving_account", { length: 120 }).notNull(),
    instructions: text("instructions"),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_methods_tournament_provider_uidx").on(
      table.tournamentId,
      table.provider,
    ),
    index("payment_methods_enabled_idx").on(table.tournamentId, table.enabled),
  ],
).enableRLS();
