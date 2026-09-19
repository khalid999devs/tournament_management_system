import "server-only";

import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import {
  games,
  participants,
  paymentMethods,
  payments,
  registrationGameEntries,
  registrations,
  tournamentGames,
  tournaments,
} from "@/db/schema";

// The name admins configured ("bKash"), not the stored key ("BKASH").
const providerName = sql<string>`coalesce((
  select ${paymentMethods.displayName} from ${paymentMethods}
  where ${paymentMethods.tournamentId} = ${registrations.tournamentId}
    and ${paymentMethods.provider} = ${payments.provider}
  limit 1
), ${payments.provider})`;

export const registrationFilterSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z
    .enum(["ALL", "PENDING_REVIEW", "CONFIRMED", "REJECTED", "CANCELLED"])
    .catch("ALL"),
  game: z.string().uuid().or(z.literal("")).catch(""),
  department: z.string().trim().max(120).catch(""),
  provider: z.string().trim().max(40).catch(""),
  from: z.iso.date().or(z.literal("")).catch(""),
  to: z.iso.date().or(z.literal("")).catch(""),
  sort: z.enum(["newest", "oldest", "name"]).catch("newest"),
  page: z.coerce.number().int().positive().catch(1),
});

export type RegistrationFilters = z.infer<typeof registrationFilterSchema>;

const pageSize = 25;

export async function getAdminRegistrationPage(input: unknown) {
  const filters = registrationFilterSchema.parse(input);
  const db = getDatabase();
  const conditions = buildConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;
  const [{ count }] = await db
    .select({ count: countDistinct(registrations.id) })
    .from(registrations)
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .innerJoin(payments, eq(payments.registrationId, registrations.id))
    .where(where);
  const total = Number(count);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pageCount);
  const order = getOrder(filters.sort);
  const rows = await db
    .select({
      id: registrations.id,
      code: registrations.code,
      status: registrations.status,
      submittedAt: registrations.submittedAt,
      totalFeeMinor: registrations.totalFeeMinor,
      participantName: participants.fullName,
      studentId: participants.normalizedStudentId,
      department: participants.department,
      paymentProvider: providerName,
      paymentStatus: payments.status,
      transactionId: payments.transactionIdRaw,
      tournamentName: tournaments.name,
      gameNames: sql<string>`coalesce(string_agg(distinct ${games.name}, ', ' order by ${games.name}), '')`,
    })
    .from(registrations)
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .innerJoin(tournaments, eq(registrations.tournamentId, tournaments.id))
    .innerJoin(payments, eq(payments.registrationId, registrations.id))
    .innerJoin(
      registrationGameEntries,
      eq(registrationGameEntries.registrationId, registrations.id),
    )
    .innerJoin(
      tournamentGames,
      eq(registrationGameEntries.tournamentGameId, tournamentGames.id),
    )
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(where)
    .groupBy(registrations.id, participants.id, payments.id, tournaments.id)
    .orderBy(...order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [filterGames, departments, providers] = await Promise.all([
    db
      .selectDistinct({ id: tournamentGames.id, name: games.name })
      .from(tournamentGames)
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .orderBy(games.name),
    db
      .selectDistinct({ value: participants.department })
      .from(participants)
      .orderBy(participants.department),
    db
      .selectDistinct({
        value: paymentMethods.provider,
        label: paymentMethods.displayName,
      })
      .from(paymentMethods)
      .orderBy(paymentMethods.displayName),
  ]);

  return {
    filters: { ...filters, page },
    rows,
    total,
    pageCount,
    pageSize,
    options: {
      games: filterGames,
      departments: departments.map((item) => item.value),
      providers,
    },
  };
}

export async function getAdminRegistrationDetail(id: string) {
  const db = getDatabase();
  const [registration] = await db
    .select({
      id: registrations.id,
      code: registrations.code,
      status: registrations.status,
      totalFeeMinor: registrations.totalFeeMinor,
      submittedAt: registrations.submittedAt,
      reviewedAt: registrations.reviewedAt,
      rejectionReason: registrations.rejectionReason,
      internalNote: registrations.internalNote,
      participantName: participants.fullName,
      studentId: participants.normalizedStudentId,
      email: participants.email,
      phone: participants.phone,
      department: participants.department,
      academicYear: participants.academicYear,
      tournamentName: tournaments.name,
      paymentProvider: providerName,
      receivingAccount: payments.receivingAccountSnapshot,
      expectedAmountMinor: payments.expectedAmountMinor,
      transactionId: payments.transactionIdRaw,
      paymentStatus: payments.status,
    })
    .from(registrations)
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .innerJoin(tournaments, eq(registrations.tournamentId, tournaments.id))
    .innerJoin(payments, eq(payments.registrationId, registrations.id))
    .where(eq(registrations.id, id))
    .limit(1);

  if (!registration) return null;

  const entries = await db
    .select({
      id: registrationGameEntries.id,
      status: registrationGameEntries.status,
      gameName: games.name,
      feeMinor: tournamentGames.feeMinor,
    })
    .from(registrationGameEntries)
    .innerJoin(
      tournamentGames,
      eq(registrationGameEntries.tournamentGameId, tournamentGames.id),
    )
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(eq(registrationGameEntries.registrationId, id))
    .orderBy(tournamentGames.sortOrder, games.name);

  return { ...registration, entries };
}

export async function getAdminDashboardMetrics() {
  const db = getDatabase();
  const rows = await db
    .select({ status: registrations.status, count: sql<number>`count(*)::int` })
    .from(registrations)
    .groupBy(registrations.status);
  const counts = Object.fromEntries(rows.map((row) => [row.status, row.count]));

  return {
    pending: counts.PENDING_REVIEW ?? 0,
    confirmed: counts.CONFIRMED ?? 0,
    rejected: counts.REJECTED ?? 0,
    total: rows.reduce((sum, row) => sum + row.count, 0),
  };
}

export function buildConditions(filters: RegistrationFilters) {
  const conditions: SQL[] = [];

  if (filters.status !== "ALL") {
    conditions.push(eq(registrations.status, filters.status));
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(
      ilike(registrations.code, pattern),
      ilike(participants.fullName, pattern),
      ilike(participants.normalizedStudentId, pattern),
      ilike(participants.email, pattern),
      ilike(participants.phone, pattern),
      ilike(payments.transactionIdNormalized, pattern),
    );

    if (search) conditions.push(search);
  }

  if (filters.department) {
    conditions.push(eq(participants.department, filters.department));
  }

  if (filters.provider) {
    conditions.push(eq(payments.provider, filters.provider));
  }

  if (filters.game) {
    conditions.push(sql`exists (
      select 1 from registration_game_entries filter_entries
      where filter_entries.registration_id = ${registrations.id}
        and filter_entries.tournament_game_id = ${filters.game}
    )`);
  }

  if (filters.from) {
    conditions.push(
      gte(
        registrations.submittedAt,
        new Date(`${filters.from}T00:00:00+06:00`),
      ),
    );
  }

  if (filters.to) {
    const inclusiveEnd = new Date(`${filters.to}T23:59:59.999+06:00`);
    conditions.push(lte(registrations.submittedAt, inclusiveEnd));
  }

  return conditions;
}

export function getOrder(sort: RegistrationFilters["sort"]): SQL[] {
  if (sort === "oldest") {
    return [asc(registrations.submittedAt), asc(registrations.id)];
  }

  if (sort === "name") {
    return [
      asc(participants.fullName),
      desc(registrations.submittedAt),
      desc(registrations.id),
    ];
  }

  return [desc(registrations.submittedAt), desc(registrations.id)];
}
