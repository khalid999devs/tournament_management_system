import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import { notifications, registrations } from "@/db/schema";

export const notificationTypeLabels = {
  REGISTRATION_SUBMITTED: "Registration received",
  REGISTRATION_APPROVED: "Registration confirmed",
  REGISTRATION_REJECTED: "Registration not confirmed",
  EVENT_REMINDER: "Event reminder",
  SCHEDULE_CHANGED: "Schedule change",
  OPERATOR_INVITE: "Operator invitation",
} as const;

type NotificationType = keyof typeof notificationTypeLabels;

const notificationFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["ALL", "QUEUED", "SENDING", "SENT", "FAILED"]).catch("ALL"),
  type: z
    .enum(
      Object.keys(notificationTypeLabels) as [
        NotificationType,
        ...NotificationType[],
      ],
    )
    .or(z.literal(""))
    .catch(""),
  from: z.iso.date().or(z.literal("")).catch(""),
  to: z.iso.date().or(z.literal("")).catch(""),
  sort: z.enum(["newest", "oldest"]).catch("newest"),
  page: z.coerce.number().int().positive().catch(1),
});

const pageSize = 25;

export async function getAdminNotificationPage(input: unknown) {
  const filters = notificationFiltersSchema.parse(input);
  const conditions: SQL[] = [];

  if (filters.status !== "ALL") {
    conditions.push(eq(notifications.status, filters.status));
  }

  if (filters.q) {
    conditions.push(ilike(notifications.recipientEmail, `%${filters.q}%`));
  }

  if (filters.type) conditions.push(eq(notifications.type, filters.type));

  if (filters.from) {
    conditions.push(
      gte(notifications.createdAt, new Date(`${filters.from}T00:00:00+06:00`)),
    );
  }

  if (filters.to) {
    conditions.push(
      lte(
        notifications.createdAt,
        new Date(`${filters.to}T23:59:59.999+06:00`),
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDatabase();
  const [{ value }] = await db
    .select({ value: count() })
    .from(notifications)
    .where(where);
  const total = Number(value);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pageCount);
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      status: notifications.status,
      recipientEmail: notifications.recipientEmail,
      retryCount: notifications.retryCount,
      providerMessageId: notifications.providerMessageId,
      errorText: notifications.errorText,
      sentAt: notifications.sentAt,
      createdAt: notifications.createdAt,
      registrationId: notifications.registrationId,
      registrationCode: registrations.code,
    })
    .from(notifications)
    .leftJoin(registrations, eq(notifications.registrationId, registrations.id))
    .where(where)
    .orderBy(
      filters.sort === "oldest"
        ? asc(notifications.createdAt)
        : desc(notifications.createdAt),
      filters.sort === "oldest"
        ? asc(notifications.id)
        : desc(notifications.id),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    filters: { ...filters, page },
    rows,
    total,
    pageCount,
  };
}
