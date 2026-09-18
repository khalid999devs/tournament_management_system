import { sql } from "drizzle-orm";
import {
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
import { notificationStatusEnum, notificationTypeEnum } from "./enums";
import { registrations } from "./registrations";
import { staffProfiles } from "./staff";

export type AuditSnapshot = Record<string, unknown>;
export type RequestMetadata = {
  requestId?: string;
  ipHash?: string;
  userAgent?: string;
};

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id").references(() => registrations.id),
    staffProfileId: uuid("staff_profile_id").references(() => staffProfiles.id),
    recipientEmail: varchar("recipient_email", { length: 254 }).notNull(),
    type: notificationTypeEnum("type").notNull(),
    status: notificationStatusEnum("status").notNull().default("QUEUED"),
    providerMessageId: varchar("provider_message_id", { length: 180 }),
    errorText: text("error_text"),
    retryCount: integer("retry_count").notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index("notifications_recipient_idx").on(
      table.recipientEmail,
      table.createdAt,
    ),
    index("notifications_registration_idx").on(table.registrationId),
    index("notifications_staff_profile_idx").on(table.staffProfileId),
    uniqueIndex("notifications_idempotency_uidx").on(table.idempotencyKey),
    check(
      "notifications_retry_nonnegative_check",
      sql`${table.retryCount} >= 0`,
    ),
  ],
).enableRLS();

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorStaffId: uuid("actor_staff_id").references(() => staffProfiles.id),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before_json").$type<AuditSnapshot>(),
    after: jsonb("after_json").$type<AuditSnapshot>(),
    reason: text("reason"),
    requestMetadata: jsonb("request_metadata").$type<RequestMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_created_idx").on(table.createdAt, table.id),
    index("audit_logs_actor_created_idx").on(
      table.actorStaffId,
      table.createdAt,
      table.id,
    ),
    index("audit_logs_action_created_idx").on(
      table.action,
      table.createdAt,
      table.id,
    ),
    index("audit_logs_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
).enableRLS();
