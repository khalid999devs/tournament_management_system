import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { assignmentScopeEnum } from "./enums";
import { matches, rounds } from "./matches";
import { registrationGameEntries } from "./registrations";
import { staffProfiles } from "./staff";
import { tournamentGames, tournaments } from "./tournaments";

export type OperatorCapability =
  "VIEW" | "SCORE_UPDATE" | "FINALIZE_MATCH" | "ISSUE_REPORT";

export const operatorAssignments = pgTable(
  "operator_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => staffProfiles.id),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    scopeType: assignmentScopeEnum("scope_type").notNull(),
    tournamentGameId: uuid("tournament_game_id").references(
      () => tournamentGames.id,
    ),
    roundId: uuid("round_id").references(() => rounds.id),
    matchId: uuid("match_id").references(() => matches.id),
    registrationGameEntryId: uuid("registration_game_entry_id").references(
      () => registrationGameEntries.id,
    ),
    capabilities: jsonb("capabilities")
      .$type<OperatorCapability[]>()
      .notNull()
      .default(["VIEW", "SCORE_UPDATE", "FINALIZE_MATCH", "ISSUE_REPORT"]),
    active: boolean("active").notNull().default(true),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => staffProfiles.id),
    revokedBy: uuid("revoked_by").references(() => staffProfiles.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("operator_assignments_operator_active_idx").on(
      table.operatorId,
      table.active,
      table.tournamentId,
    ),
    index("operator_assignments_tournament_idx").on(table.tournamentId),
    index("operator_assignments_game_idx").on(
      table.tournamentGameId,
      table.active,
    ),
    index("operator_assignments_round_idx").on(table.roundId, table.active),
    index("operator_assignments_match_idx").on(table.matchId, table.active),
    index("operator_assignments_entry_idx").on(
      table.registrationGameEntryId,
      table.active,
    ),
    index("operator_assignments_granted_by_idx").on(table.grantedBy),
    index("operator_assignments_revoked_by_idx").on(table.revokedBy),
    check(
      "operator_assignments_scope_target_check",
      sql`
        (${table.scopeType} = 'ALL_TOURNAMENT' and ${table.tournamentGameId} is null and ${table.roundId} is null and ${table.matchId} is null and ${table.registrationGameEntryId} is null)
        or (${table.scopeType} = 'GAME' and ${table.tournamentGameId} is not null and ${table.roundId} is null and ${table.matchId} is null and ${table.registrationGameEntryId} is null)
        or (${table.scopeType} = 'ROUND' and ${table.tournamentGameId} is null and ${table.roundId} is not null and ${table.matchId} is null and ${table.registrationGameEntryId} is null)
        or (${table.scopeType} = 'MATCH' and ${table.tournamentGameId} is null and ${table.roundId} is null and ${table.matchId} is not null and ${table.registrationGameEntryId} is null)
        or (${table.scopeType} = 'PARTICIPANT_ENTRY' and ${table.tournamentGameId} is null and ${table.roundId} is null and ${table.matchId} is null and ${table.registrationGameEntryId} is not null)
      `,
    ),
    check(
      "operator_assignments_revocation_check",
      sql`(${table.active} and ${table.revokedAt} is null and ${table.revokedBy} is null) or (not ${table.active} and ${table.revokedAt} is not null)`,
    ),
    // One row per operator and target: granting the same scope again updates
    // the capabilities instead of stacking another assignment beside it.
    unique("operator_assignments_scope_unique")
      .on(
        table.operatorId,
        table.scopeType,
        table.tournamentId,
        table.tournamentGameId,
        table.roundId,
        table.matchId,
        table.registrationGameEntryId,
      )
      .nullsNotDistinct(),
  ],
).enableRLS();
