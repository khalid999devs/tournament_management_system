import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { issueStatusEnum } from "./enums";
import { matches } from "./matches";
import { staffProfiles } from "./staff";
import { tournaments } from "./tournaments";

// Problems staff flag for admin attention, usually about one match.
// client_request_id makes a resubmitted report from a flaky phone land once.
export const issueReports = pgTable(
  "issue_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    matchId: uuid("match_id").references(() => matches.id),
    reportedBy: uuid("reported_by")
      .notNull()
      .references(() => staffProfiles.id),
    category: varchar("category", { length: 40 }).notNull(),
    message: text("message").notNull(),
    status: issueStatusEnum("status").notNull().default("OPEN"),
    resolutionNote: text("resolution_note"),
    resolvedBy: uuid("resolved_by").references(() => staffProfiles.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    clientRequestId: uuid("client_request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("issue_reports_client_request_uidx").on(table.clientRequestId),
    index("issue_reports_queue_idx").on(
      table.tournamentId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("issue_reports_match_idx").on(table.matchId, table.createdAt),
    index("issue_reports_reporter_idx").on(table.reportedBy, table.createdAt),
    index("issue_reports_resolved_by_idx").on(table.resolvedBy),
    check(
      "issue_reports_resolution_check",
      sql`(${table.status} = 'RESOLVED') = (${table.resolvedAt} is not null)`,
    ),
  ],
).enableRLS();
