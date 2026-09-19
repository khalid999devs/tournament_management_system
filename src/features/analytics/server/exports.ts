import "server-only";

import { alias } from "drizzle-orm/pg-core";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import {
  auditLogs,
  games,
  matches,
  matchUpdates,
  participants,
  payments,
  registrationGameEntries,
  registrations,
  rounds,
  staffProfiles,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import {
  buildConditions,
  getOrder,
  registrationFilterSchema,
} from "@/features/admin/server/registration-queries";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { describeLogItem } from "@/features/matches/components/describe";
import {
  describeStatus,
  describeUpdateType,
  type MatchStatus,
} from "@/features/matches/domain/commands";
import type {
  MatchEntrant,
  MatchLogItem,
} from "@/features/matches/server/match-queries";
import {
  entrantNames,
  resolveMatchFilters,
} from "@/features/matches/server/admin-match-queries";
import { exportFilename, toCsv } from "../domain/csv";

export const exportKinds = [
  "registrations",
  "participants",
  "payments",
  "results",
  "activity",
] as const;

export type ExportKind = (typeof exportKinds)[number];

export function isExportKind(value: string): value is ExportKind {
  return exportKinds.includes(value as ExportKind);
}

type Params = Record<string, string | undefined>;
type Table = { headers: string[]; rows: unknown[][]; filters: unknown };

const optionalId = z.uuid().or(z.literal("")).catch("");
const optionalDay = z.iso.date().or(z.literal("")).catch("");
const bdt = (minor: number) => minor / 100;

// Every export reads the whole filtered result set on the server; nothing
// is limited to one page.
export async function buildExport(kind: ExportKind, params: Params) {
  const table = await builders[kind](params);
  return {
    filename: exportFilename(kind),
    csv: toCsv(table.headers, table.rows),
    rowCount: table.rows.length,
    filters: table.filters,
  };
}

export async function recordExport(
  actorId: string,
  kind: ExportKind,
  result: { rowCount: number; filters: unknown },
) {
  await getDatabase()
    .insert(auditLogs)
    .values({
      actorStaffId: actorId,
      action: "REPORT_EXPORTED",
      entityType: "report",
      after: { kind, rows: result.rowCount, filters: result.filters },
    });
}

const builders: Record<ExportKind, (params: Params) => Promise<Table>> = {
  registrations: exportRegistrations,
  participants: exportParticipants,
  payments: exportPayments,
  results: exportResults,
  activity: exportActivity,
};

// Same filters as the Registrations page, every matching row.
async function exportRegistrations(params: Params): Promise<Table> {
  const filters = registrationFilterSchema.parse(params);
  const conditions = buildConditions(filters);
  const rows = await getDatabase()
    .select({
      code: registrations.code,
      submittedAt: registrations.submittedAt,
      status: registrations.status,
      name: participants.fullName,
      studentId: participants.normalizedStudentId,
      department: participants.department,
      year: participants.academicYear,
      email: participants.email,
      phone: participants.phone,
      games: sql<string>`coalesce(string_agg(distinct ${games.name}, ', ' order by ${games.name}), '')`,
      totalFeeMinor: registrations.totalFeeMinor,
      provider: payments.provider,
      transactionId: payments.transactionIdRaw,
      paymentStatus: payments.status,
      reviewedAt: registrations.reviewedAt,
      rejectionReason: registrations.rejectionReason,
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
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(registrations.id, participants.id, payments.id, tournaments.id)
    .orderBy(...getOrder(filters.sort));

  return {
    filters: { ...filters, page: undefined },
    headers: [
      "Registration code",
      "Submitted (Dhaka)",
      "Status",
      "Full name",
      "Student ID",
      "Department",
      "Academic year",
      "Email",
      "Phone",
      "Games",
      "Total fee (BDT)",
      "Payment method",
      "Transaction ID",
      "Payment status",
      "Reviewed (Dhaka)",
      "Rejection reason",
    ],
    rows: rows.map((row) => [
      row.code,
      row.submittedAt,
      row.status,
      row.name,
      row.studentId,
      row.department,
      row.year,
      row.email,
      row.phone,
      row.games,
      bdt(row.totalFeeMinor),
      row.provider,
      row.transactionId,
      row.paymentStatus,
      row.reviewedAt,
      row.rejectionReason,
    ]),
  };
}

// Confirmed players by game, for check-in sheets and draws.
async function exportParticipants(params: Params): Promise<Table> {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  const filters = {
    game: optionalId.parse(params.game ?? ""),
    department: z.string().trim().max(120).catch("").parse(params.department),
  };
  if (!tournamentId) return emptyParticipants(filters);

  const conditions: SQL[] = [
    eq(tournamentGames.tournamentId, tournamentId),
    eq(registrationGameEntries.status, "CONFIRMED"),
  ];
  if (filters.game) conditions.push(eq(tournamentGames.id, filters.game));
  if (filters.department) {
    conditions.push(eq(participants.department, filters.department));
  }

  const rows = await db
    .select({
      game: games.name,
      code: registrations.code,
      name: participants.fullName,
      studentId: participants.normalizedStudentId,
      department: participants.department,
      year: participants.academicYear,
      email: participants.email,
      phone: participants.phone,
      confirmedAt: registrations.reviewedAt,
    })
    .from(registrationGameEntries)
    .innerJoin(
      tournamentGames,
      eq(registrationGameEntries.tournamentGameId, tournamentGames.id),
    )
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .innerJoin(
      registrations,
      eq(registrationGameEntries.registrationId, registrations.id),
    )
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .where(and(...conditions))
    .orderBy(
      asc(tournamentGames.sortOrder),
      asc(games.name),
      asc(participants.fullName),
      asc(registrations.code),
    );

  return {
    ...emptyParticipants(filters),
    rows: rows.map((row) => [
      row.game,
      row.code,
      row.name,
      row.studentId,
      row.department,
      row.year,
      row.email,
      row.phone,
      row.confirmedAt,
    ]),
  };
}

function emptyParticipants(filters: unknown): Table {
  return {
    filters,
    headers: [
      "Game",
      "Registration code",
      "Full name",
      "Student ID",
      "Department",
      "Academic year",
      "Email",
      "Phone",
      "Confirmed (Dhaka)",
    ],
    rows: [],
  };
}

const verifier = alias(staffProfiles, "verifier");

// Payment references for reconciling against mobile banking statements.
async function exportPayments(params: Params): Promise<Table> {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  const filters = {
    status: z
      .enum(["SUBMITTED", "VERIFIED", "REJECTED", "REFUNDED"])
      .or(z.literal(""))
      .catch("")
      .parse(params.status ?? ""),
    provider: z.string().trim().max(40).catch("").parse(params.provider),
    from: optionalDay.parse(params.from ?? ""),
    to: optionalDay.parse(params.to ?? ""),
  };
  const headers = [
    "Registration code",
    "Full name",
    "Student ID",
    "Payment method",
    "Paid to",
    "Transaction ID",
    "Expected amount (BDT)",
    "Payment status",
    "Registration status",
    "Submitted (Dhaka)",
    "Verified (Dhaka)",
    "Verified by",
  ];
  if (!tournamentId) return { filters, headers, rows: [] };

  const conditions: SQL[] = [eq(registrations.tournamentId, tournamentId)];
  if (filters.status) conditions.push(eq(payments.status, filters.status));
  if (filters.provider)
    conditions.push(eq(payments.provider, filters.provider));
  if (filters.from) {
    conditions.push(
      gte(payments.createdAt, new Date(`${filters.from}T00:00:00+06:00`)),
    );
  }
  if (filters.to) {
    conditions.push(
      lte(payments.createdAt, new Date(`${filters.to}T23:59:59.999+06:00`)),
    );
  }

  const rows = await db
    .select({
      code: registrations.code,
      name: participants.fullName,
      studentId: participants.normalizedStudentId,
      provider: payments.provider,
      paidTo: payments.receivingAccountSnapshot,
      transactionId: payments.transactionIdRaw,
      amountMinor: payments.expectedAmountMinor,
      paymentStatus: payments.status,
      registrationStatus: registrations.status,
      submittedAt: payments.createdAt,
      verifiedAt: payments.verifiedAt,
      verifiedBy: verifier.displayName,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .leftJoin(verifier, eq(payments.verifiedBy, verifier.id))
    .where(and(...conditions))
    .orderBy(asc(payments.createdAt), asc(payments.id));

  return {
    filters,
    headers,
    rows: rows.map((row) => [
      row.code,
      row.name,
      row.studentId,
      row.provider,
      row.paidTo,
      row.transactionId,
      bdt(row.amountMinor),
      row.paymentStatus,
      row.registrationStatus,
      row.submittedAt,
      row.verifiedAt,
      row.verifiedBy,
    ]),
  };
}

// Same filters as the match monitor, every matching match.
async function exportResults(params: Params): Promise<Table> {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  const headers = [
    "Game",
    "Round",
    "Match",
    "Status",
    "Scheduled (Dhaka)",
    "Completed (Dhaka)",
    "Table or station",
    "Players",
    "Placings",
    "Score",
  ];
  if (!tournamentId) return { filters: params, headers, rows: [] };

  const { where, filters } = await resolveMatchFilters(db, tournamentId, {
    game: params.game,
    status: params.status,
    q: params.q,
  });
  const rows = await db
    .select({
      id: matches.id,
      game: games.name,
      round: rounds.name,
      code: matches.code,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      completedAt: matches.completedAt,
      station: matches.station,
      displayScore: matches.displayScore,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(where)
    .orderBy(
      asc(tournamentGames.sortOrder),
      asc(games.name),
      asc(rounds.sequence),
      asc(matches.code),
    );
  const names = await entrantNames(rows.map((row) => row.id));

  return {
    filters,
    headers,
    rows: rows.map((row) => {
      const entrants = names.get(row.id) ?? [];
      const placed = entrants
        .filter((entrant) => entrant.placement !== null)
        .sort((a, b) => a.placement! - b.placement!);
      return [
        row.game,
        row.round,
        row.code,
        describeStatus(row.status as MatchStatus),
        row.scheduledAt,
        row.completedAt,
        row.station,
        entrants.map((entrant) => entrant.name).join(" vs "),
        placed
          .map((entrant) => `${entrant.placement}. ${entrant.name}`)
          .join("; "),
        row.displayScore,
      ];
    }),
  };
}

// Every accepted score change, with who entered it and when.
async function exportActivity(params: Params): Promise<Table> {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  const filters = {
    staff: optionalId.parse(params.staff ?? ""),
    from: optionalDay.parse(params.from ?? ""),
    to: optionalDay.parse(params.to ?? ""),
  };
  const headers = [
    "Server time (Dhaka)",
    "Device time (Dhaka)",
    "Staff member",
    "Role",
    "Game",
    "Match",
    "Version",
    "Action",
    "Details",
  ];
  if (!tournamentId) return { filters, headers, rows: [] };

  const conditions: SQL[] = [eq(tournamentGames.tournamentId, tournamentId)];
  if (filters.staff) {
    conditions.push(eq(matchUpdates.actorStaffId, filters.staff));
  }
  if (filters.from) {
    conditions.push(
      gte(matchUpdates.createdAt, new Date(`${filters.from}T00:00:00+06:00`)),
    );
  }
  if (filters.to) {
    conditions.push(
      lte(matchUpdates.createdAt, new Date(`${filters.to}T23:59:59.999+06:00`)),
    );
  }

  const rows = await db
    .select({
      matchId: matches.id,
      createdAt: matchUpdates.createdAt,
      deviceTime: matchUpdates.deviceTime,
      staffName: staffProfiles.displayName,
      role: staffProfiles.role,
      game: games.name,
      code: matches.code,
      version: matchUpdates.matchVersion,
      type: matchUpdates.updateType,
      payload: matchUpdates.payload,
      id: matchUpdates.id,
    })
    .from(matchUpdates)
    .innerJoin(staffProfiles, eq(matchUpdates.actorStaffId, staffProfiles.id))
    .innerJoin(matches, eq(matchUpdates.matchId, matches.id))
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .innerJoin(games, eq(tournamentGames.gameId, games.id))
    .where(and(...conditions))
    .orderBy(desc(matchUpdates.createdAt), desc(matchUpdates.id));

  const names = await entrantNames([
    ...new Set(rows.map((row) => row.matchId)),
  ]);

  return {
    filters,
    headers,
    rows: rows.map((row) => {
      const entrants = (names.get(row.matchId) ?? []) as MatchEntrant[];
      const item = {
        type: row.type,
        payload: row.payload,
      } as MatchLogItem;
      return [
        row.createdAt,
        row.deviceTime,
        row.staffName,
        row.role === "SUPER_ADMIN" ? "Admin" : "Operator",
        row.game,
        row.code,
        row.version,
        describeUpdateType(row.type),
        describeLogItem(item, entrants),
      ];
    }),
  };
}

// Choices for the Reports page filters.
export async function getExportOptions() {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  if (!tournamentId) return null;

  const [gameOptions, departments, providers, staff] = await Promise.all([
    db
      .select({ id: tournamentGames.id, name: games.name })
      .from(tournamentGames)
      .innerJoin(games, eq(tournamentGames.gameId, games.id))
      .where(eq(tournamentGames.tournamentId, tournamentId))
      .orderBy(asc(tournamentGames.sortOrder), asc(games.name)),
    db
      .selectDistinct({ value: participants.department })
      .from(participants)
      .innerJoin(
        registrations,
        eq(registrations.participantId, participants.id),
      )
      .where(eq(registrations.tournamentId, tournamentId))
      .orderBy(participants.department),
    db
      .selectDistinct({ value: payments.provider })
      .from(payments)
      .innerJoin(registrations, eq(payments.registrationId, registrations.id))
      .where(eq(registrations.tournamentId, tournamentId))
      .orderBy(payments.provider),
    db
      .select({ id: staffProfiles.id, name: staffProfiles.displayName })
      .from(staffProfiles)
      .where(inArray(staffProfiles.role, ["SUPER_ADMIN", "SCORE_OPERATOR"]))
      .orderBy(staffProfiles.displayName),
  ]);

  return {
    games: gameOptions,
    departments: departments.map((row) => row.value),
    providers: providers.map((row) => row.value),
    staff,
  };
}
