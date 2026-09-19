import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { staffRoleEnum } from "./enums";

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: uuid("auth_user_id").notNull(),
    email: varchar("email", { length: 254 }),
    role: staffRoleEnum("role").notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("staff_profiles_auth_user_uidx").on(table.authUserId),
    uniqueIndex("staff_profiles_email_uidx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    index("staff_profiles_role_active_idx").on(table.role, table.active),
  ],
).enableRLS();
