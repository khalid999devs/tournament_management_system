import "server-only";

import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDatabase, type Database } from "@/db";
import {
  auditLogs,
  issueReports,
  matches,
  operatorAssignments,
  rounds,
  staffProfiles,
  tournamentGames,
} from "@/db/schema";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import type { MatchActor } from "@/features/matches/server/match-commands";
import { operatorMatchAccessPredicate } from "@/features/operators/server/workload";
import type { IssueReportInput } from "../domain/issues";

export type IssueErrorCode = "NOT_FOUND" | "UNAUTHORIZED" | "NO_TOURNAMENT";

export class IssueError extends Error {
  constructor(readonly code: IssueErrorCode) {
    super(code);
    this.name = "IssueError";
  }
}

export type IssueItem = {
  id: string;
  category: string;
  message: string;
  status: "OPEN" | "RESOLVED";
  reporterName: string;
  createdAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolverName: string | null;
  matchId: string | null;
  matchCode: string | null;
};

type Reader = Pick<Database, "select">;

// Operators need ISSUE_REPORT on the match (or, for a general report, on
// any assignment in the tournament); admins may always report. A resent
// report with the same client request id lands once.
export async function reportIssue(input: {
  actor: MatchActor;
  report: IssueReportInput;
}) {
  const { actor, report } = input;
  const isAdmin = actor.role === "SUPER_ADMIN";

  return getDatabase().transaction(async (tx) => {
    const [staff] = await tx
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.id, actor.id),
          eq(staffProfiles.role, actor.role),
          eq(staffProfiles.active, true),
        ),
      )
      .limit(1);
    if (!staff) throw new IssueError("UNAUTHORIZED");

    let tournamentId: string | null;
    if (report.matchId) {
      const [match] = await tx
        .select({
          tournamentId: tournamentGames.tournamentId,
          allowed: isAdmin
            ? sql<boolean>`true`
            : sql<boolean>`${operatorMatchAccessPredicate(actor.id, "ISSUE_REPORT", tx)}`,
        })
        .from(matches)
        .innerJoin(rounds, eq(matches.roundId, rounds.id))
        .innerJoin(
          tournamentGames,
          eq(rounds.tournamentGameId, tournamentGames.id),
        )
        .where(eq(matches.id, report.matchId))
        .limit(1);
      if (!match) throw new IssueError("NOT_FOUND");
      if (!match.allowed) throw new IssueError("UNAUTHORIZED");
      tournamentId = match.tournamentId;
    } else {
      tournamentId = await findCurrentTournamentId(tx);
      if (!tournamentId) throw new IssueError("NO_TOURNAMENT");
      if (!isAdmin) {
        const [grant] = await tx
          .select({ id: operatorAssignments.id })
          .from(operatorAssignments)
          .where(
            and(
              eq(operatorAssignments.operatorId, actor.id),
              eq(operatorAssignments.tournamentId, tournamentId),
              eq(operatorAssignments.active, true),
              sql`${operatorAssignments.capabilities} @> '["ISSUE_REPORT"]'::jsonb`,
            ),
          )
          .limit(1);
        if (!grant) throw new IssueError("UNAUTHORIZED");
      }
    }

    const [created] = await tx
      .insert(issueReports)
      .values({
        tournamentId,
        matchId: report.matchId,
        reportedBy: actor.id,
        category: report.category,
        message: report.message,
        clientRequestId: report.clientRequestId,
      })
      .onConflictDoNothing({ target: issueReports.clientRequestId })
      .returning({ id: issueReports.id });

    if (!created) {
      const [existing] = await tx
        .select({ id: issueReports.id, reportedBy: issueReports.reportedBy })
        .from(issueReports)
        .where(eq(issueReports.clientRequestId, report.clientRequestId))
        .limit(1);
      if (!existing || existing.reportedBy !== actor.id) {
        throw new IssueError("UNAUTHORIZED");
      }
      return { id: existing.id, tournamentId, duplicate: true };
    }

    await tx.insert(auditLogs).values({
      actorStaffId: actor.id,
      action: "ISSUE_REPORTED",
      entityType: "issue_report",
      entityId: created.id,
      after: { matchId: report.matchId, category: report.category },
    });

    return { id: created.id, tournamentId, duplicate: false };
  });
}

// Resolving twice is harmless: the second call changes nothing.
export async function resolveIssue(input: {
  actorId: string;
  issueId: string;
  note?: string;
}) {
  return getDatabase().transaction(async (tx) => {
    const note = input.note?.trim() || null;
    const [updated] = await tx
      .update(issueReports)
      .set({
        status: "RESOLVED",
        resolutionNote: note,
        resolvedBy: input.actorId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(issueReports.id, input.issueId),
          eq(issueReports.status, "OPEN"),
        ),
      )
      .returning({
        matchId: issueReports.matchId,
        tournamentId: issueReports.tournamentId,
      });

    if (!updated) {
      const [existing] = await tx
        .select({
          matchId: issueReports.matchId,
          tournamentId: issueReports.tournamentId,
        })
        .from(issueReports)
        .where(eq(issueReports.id, input.issueId))
        .limit(1);
      if (!existing) throw new IssueError("NOT_FOUND");
      return { ...existing, changed: false };
    }

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "ISSUE_RESOLVED",
      entityType: "issue_report",
      entityId: input.issueId,
      before: { status: "OPEN" },
      after: { status: "RESOLVED", note },
    });

    return { ...updated, changed: true };
  });
}

const reporter = alias(staffProfiles, "reporter");
const resolver = alias(staffProfiles, "resolver");

function issueQuery(db: Reader, where: SQL | undefined) {
  return db
    .select({
      id: issueReports.id,
      category: issueReports.category,
      message: issueReports.message,
      status: issueReports.status,
      reporterName: reporter.displayName,
      createdAt: issueReports.createdAt,
      resolutionNote: issueReports.resolutionNote,
      resolvedAt: issueReports.resolvedAt,
      resolverName: resolver.displayName,
      matchId: issueReports.matchId,
      matchCode: matches.code,
    })
    .from(issueReports)
    .innerJoin(reporter, eq(issueReports.reportedBy, reporter.id))
    .leftJoin(resolver, eq(issueReports.resolvedBy, resolver.id))
    .leftJoin(matches, eq(issueReports.matchId, matches.id))
    .where(where)
    .orderBy(desc(issueReports.createdAt), desc(issueReports.id));
}

function toItem(row: Awaited<ReturnType<typeof issueQuery>>[number]) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  } satisfies IssueItem;
}

export async function listMatchIssues(db: Reader, matchId: string) {
  const rows = await issueQuery(db, eq(issueReports.matchId, matchId)).limit(
    20,
  );
  return rows.map(toItem);
}

export async function listOpenIssues(tournamentId: string, limit: number) {
  const rows = await issueQuery(
    getDatabase(),
    and(
      eq(issueReports.tournamentId, tournamentId),
      eq(issueReports.status, "OPEN"),
    ),
  ).limit(limit);
  return rows.map(toItem);
}

export async function listOwnIssues(staffId: string) {
  const rows = await issueQuery(
    getDatabase(),
    eq(issueReports.reportedBy, staffId),
  ).limit(10);
  return rows.map(toItem);
}

export async function countOpenIssues(tournamentId?: string | null) {
  const db = getDatabase();
  const id = tournamentId ?? (await findCurrentTournamentId(db));
  if (!id) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(issueReports)
    .where(
      and(eq(issueReports.tournamentId, id), eq(issueReports.status, "OPEN")),
    );
  return Number(row?.value ?? 0);
}

const pageSize = 25;

export async function getAdminIssuePage(input: {
  status?: string;
  page?: string;
}) {
  const db = getDatabase();
  const tournamentId = await findCurrentTournamentId(db);
  const status =
    input.status === "RESOLVED" || input.status === "ALL"
      ? input.status
      : "OPEN";
  if (!tournamentId) {
    return { rows: [], total: 0, page: 1, pageCount: 1, status, open: 0 };
  }

  const scope = eq(issueReports.tournamentId, tournamentId);
  const where =
    status === "ALL" ? scope : and(scope, eq(issueReports.status, status));
  const [[{ value: total }], open] = await Promise.all([
    db.select({ value: count() }).from(issueReports).where(where),
    countOpenIssues(tournamentId),
  ]);
  const pageCount = Math.max(1, Math.ceil(Number(total) / pageSize));
  const requested = Number(input.page);
  const page = Math.min(
    Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
    pageCount,
  );
  const rows = await issueQuery(db, where)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map(toItem),
    total: Number(total),
    page,
    pageCount,
    status,
    open,
  };
}
