import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/db";
import {
  auditLogs,
  issueReports,
  matches,
  notifications,
  registrations,
  rounds,
  tournaments,
} from "@/db/schema";
import { reviewRegistration } from "@/features/admin/server/review-registration";
import { getDashboard } from "@/features/analytics/server/dashboard";
import { buildExport, recordExport } from "@/features/analytics/server/exports";
import { updateTournamentGame } from "@/features/event/server/manage-event";
import {
  countOpenIssues,
  listMatchIssues,
  reportIssue,
  resolveIssue,
} from "@/features/issues/server/issues";
import { generateBracket } from "@/features/matches/server/manage-brackets";
import {
  executeScoreCommand,
  type MatchActor,
} from "@/features/matches/server/match-commands";
import {
  queueEventReminders,
  recoverStuckNotifications,
  saveReminderSetting,
  sendQueuedNotifications,
} from "@/features/notifications/server/reminders";
import { grantOperatorAssignment } from "@/features/operators/server/manage-operators";
import { submitRegistration } from "@/features/registration/server/submit-registration";
import { signalMatchChange } from "@/lib/realtime/signal";
import {
  createStaff,
  registrationInput,
  resetDatabase,
  seedOpenEvent,
} from "./helpers";

// Email goes nowhere in tests; the outbox bookkeeping is what is checked.
const sendEmail = vi.hoisted(() =>
  vi.fn<(input: { to: string; subject: string }) => Promise<{ id: string }>>(
    async () => ({ id: "test-message" }),
  ),
);
vi.mock("@/lib/email/send", () => ({ sendEmail }));

process.env.SMTP_USER = "sender@example.test";
process.env.SMTP_PASSWORD = "test-app-password";
process.env.EMAIL_REPLY_TO = "committee@example.test";

let admin: MatchActor;
let tournamentId: string;
let gameIds: Record<string, string>;

async function submit(gameId: string) {
  const { registrationCode } = await submitRegistration(
    registrationInput(tournamentId, [gameId]),
  );
  const [row] = await getDatabase()
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.code, registrationCode));
  return row.id;
}

async function confirm(gameId: string, count: number) {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = await submit(gameId);
    await reviewRegistration({
      registrationId: id,
      decision: "APPROVE",
      actorStaffId: admin.id,
    });
    ids.push(id);
  }
  return ids;
}

// A knockout draw for Chess with `players` confirmed players.
async function drawChess(players: number) {
  const gameId = gameIds.Chess;
  await confirm(gameId, players);
  await updateTournamentGame({
    actorId: admin.id,
    tournamentGameId: gameId,
    config: {
      description: null,
      feeTaka: 50,
      capacity: 64,
      availability: "CLOSED",
      rules: null,
      sortOrder: 0,
    },
  });
  await generateBracket({
    actorId: admin.id,
    tournamentGameId: gameId,
    seeding: "RANDOM",
  });
  return getDatabase()
    .select({ id: matches.id, code: matches.code, next: matches.nextMatchId })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .where(eq(rounds.tournamentGameId, gameId))
    .orderBy(rounds.sequence, matches.code);
}

async function operatorWith(
  scope: { type: "GAME"; id: string } | { type: "MATCH"; id: string },
  capabilities: ("VIEW" | "SCORE_UPDATE" | "FINALIZE_MATCH" | "ISSUE_REPORT")[],
): Promise<MatchActor> {
  const id = await createStaff("SCORE_OPERATOR");
  await grantOperatorAssignment({
    actorId: admin.id,
    operatorId: id,
    tournamentId,
    scopeType: scope.type,
    targetId: scope.id,
    capabilities,
  });
  return { id, role: "SCORE_OPERATOR" };
}

const report = (matchId: string | null, clientRequestId = randomUUID()) => ({
  matchId,
  category: "NO_SHOW" as const,
  message: "Seat 2 did not arrive",
  clientRequestId,
});

beforeEach(async () => {
  await resetDatabase();
  sendEmail.mockClear();
  admin = { id: await createStaff("SUPER_ADMIN"), role: "SUPER_ADMIN" };
  ({ tournamentId, gameIds } = await seedOpenEvent(admin.id, {
    Chess: 64,
    Ludo: 64,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_SECRET_KEY;
});

describe("problem reports", () => {
  it("lets scoped operators report once per request and admins resolve", async () => {
    const [first, second] = await drawChess(4);
    const reporter = await operatorWith({ type: "GAME", id: gameIds.Chess }, [
      "VIEW",
      "ISSUE_REPORT",
    ]);
    const requestId = randomUUID();

    // The same report sent three times at once (a phone retrying) lands once.
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        reportIssue({ actor: reporter, report: report(first.id, requestId) }),
      ),
    );
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);

    const stored = await listMatchIssues(getDatabase(), first.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      status: "OPEN",
      reporterName: "Test Operator",
      matchCode: first.code,
    });
    expect(await countOpenIssues(tournamentId)).toBe(1);

    const resolved = await resolveIssue({
      actorId: admin.id,
      issueId: stored[0].id,
      note: "Walkover recorded",
    });
    expect(resolved).toMatchObject({ changed: true, matchId: first.id });
    // Resolving again changes nothing.
    expect(
      await resolveIssue({ actorId: admin.id, issueId: stored[0].id }),
    ).toMatchObject({ changed: false });

    const [after] = await listMatchIssues(getDatabase(), first.id);
    expect(after).toMatchObject({
      status: "RESOLVED",
      resolutionNote: "Walkover recorded",
      resolverName: "Test Admin",
    });
    expect(await countOpenIssues(tournamentId)).toBe(0);

    const trail = await getDatabase()
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityType, "issue_report"));
    expect(trail.map((row) => row.action).sort()).toEqual([
      "ISSUE_REPORTED",
      "ISSUE_RESOLVED",
    ]);

    // A match outside the operator's assignment is refused.
    const matchOnly = await operatorWith({ type: "MATCH", id: first.id }, [
      "VIEW",
      "ISSUE_REPORT",
    ]);
    await expect(
      reportIssue({ actor: matchOnly, report: report(second.id) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("needs the ISSUE_REPORT capability, also for general reports", async () => {
    const [first] = await drawChess(2);
    const viewer = await operatorWith({ type: "GAME", id: gameIds.Chess }, [
      "VIEW",
      "SCORE_UPDATE",
    ]);
    await expect(
      reportIssue({ actor: viewer, report: report(first.id) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      reportIssue({ actor: viewer, report: report(null) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const reporter = await operatorWith({ type: "GAME", id: gameIds.Chess }, [
      "VIEW",
      "ISSUE_REPORT",
    ]);
    const general = await reportIssue({
      actor: reporter,
      report: report(null),
    });
    expect(general.tournamentId).toBe(tournamentId);
    // Admins may always report.
    await reportIssue({ actor: admin, report: report(first.id) });
    expect(await countOpenIssues(tournamentId)).toBe(2);
  });
});

describe("event reminders", () => {
  async function setStart(startsAt: Date, daysBefore: number | null) {
    await getDatabase()
      .update(tournaments)
      .set({
        startsAt,
        endsAt: new Date(startsAt.getTime() + 8 * 3_600_000),
      })
      .where(eq(tournaments.id, tournamentId));
    await saveReminderSetting({ actorId: admin.id, daysBefore });
  }

  const reminders = () =>
    getDatabase()
      .select({
        registrationId: notifications.registrationId,
        status: notifications.status,
        errorText: notifications.errorText,
      })
      .from(notifications)
      .where(eq(notifications.type, "EVENT_REMINDER"));

  it("queues one reminder per confirmed player, however often it runs", async () => {
    const confirmed = await confirm(gameIds.Chess, 3);
    await submit(gameIds.Chess); // pending: no reminder
    const startsAt = new Date("2026-12-10T04:00:00Z"); // 10:00 Dhaka
    await setStart(startsAt, 1);

    // Two days before: not due yet.
    expect(
      await queueEventReminders({ now: new Date("2026-12-08T03:00:00Z") }),
    ).toEqual({ queued: 0, due: false });

    // The daily run on the send day, three times at once.
    const now = new Date("2026-12-09T03:00:00Z");
    const runs = await Promise.all(
      [1, 2, 3].map(() => queueEventReminders({ now })),
    );
    expect(runs.reduce((sum, run) => sum + run.queued, 0)).toBe(3);
    expect(await queueEventReminders({ now })).toEqual({
      queued: 0,
      due: true,
    });
    expect((await reminders()).map((row) => row.registrationId).sort()).toEqual(
      [...confirmed].sort(),
    );

    // A player confirmed later gets theirs from the next run.
    const late = await confirm(gameIds.Chess, 1);
    expect(await queueEventReminders({ now })).toEqual({
      queued: 1,
      due: true,
    });
    expect(
      (await reminders()).some((row) => row.registrationId === late[0]),
    ).toBe(true);

    // Nothing after the event starts; "send now" says why.
    expect(await queueEventReminders({ now: startsAt })).toEqual({
      queued: 0,
      due: false,
    });
    await expect(
      queueEventReminders({ now: startsAt, force: true, actorId: admin.id }),
    ).rejects.toMatchObject({ code: "EVENT_STARTED" });
  });

  it("sends queued reminders once and skips cancelled registrations", async () => {
    const [kept, cancelled] = await confirm(gameIds.Chess, 2);
    await setStart(new Date(Date.now() + 3 * 86_400_000), null);

    // Reminders are off, but "send now" works on demand.
    expect(await queueEventReminders({ now: new Date() })).toEqual({
      queued: 0,
      due: false,
    });
    expect(
      await queueEventReminders({
        now: new Date(),
        force: true,
        actorId: admin.id,
      }),
    ).toEqual({ queued: 2, due: true });

    await getDatabase()
      .update(registrations)
      .set({ status: "CANCELLED" })
      .where(eq(registrations.id, cancelled));

    const deadline = Date.now() + 30_000;
    const [a, b] = await Promise.all([
      sendQueuedNotifications({ deadline, types: ["EVENT_REMINDER"] }),
      sendQueuedNotifications({ deadline, types: ["EVENT_REMINDER"] }),
    ]);
    // Two overlapping runs: each reminder was attempted exactly once.
    expect(a.sent + b.sent).toBe(1);
    expect(a.failed + b.failed).toBe(1);

    const rows = await reminders();
    expect(rows.find((row) => row.registrationId === kept)?.status).toBe(
      "SENT",
    );
    expect(rows.find((row) => row.registrationId === cancelled)).toMatchObject({
      status: "FAILED",
      errorText: "Not sent: the registration is no longer confirmed.",
    });
    const reminderMails = sendEmail.mock.calls.filter(([input]) =>
      input.subject.includes("event reminder"),
    );
    expect(reminderMails).toHaveLength(1);
  });

  it("recovers a message stuck while sending", async () => {
    await confirm(gameIds.Chess, 1);
    const [stuck] = await getDatabase()
      .select({ id: notifications.id })
      .from(notifications)
      .limit(1);
    await getDatabase()
      .update(notifications)
      .set({
        status: "SENDING",
        updatedAt: new Date(Date.now() - 20 * 60_000),
      })
      .where(eq(notifications.id, stuck.id));
    expect(await recoverStuckNotifications(new Date())).toBe(1);
    const [row] = await getDatabase()
      .select({ status: notifications.status })
      .from(notifications)
      .where(eq(notifications.id, stuck.id));
    expect(row.status).toBe("FAILED");
  });
});

describe("exports", () => {
  it("contain every filtered row, not one page, and are audited", async () => {
    await confirm(gameIds.Chess, 27);
    for (let index = 0; index < 3; index += 1) await submit(gameIds.Ludo);

    const all = await buildExport("registrations", {});
    expect(all.rowCount).toBe(30);
    // Header plus 30 rows; the file ends with a line break.
    const lines = all.csv.split("\r\n");
    expect(lines).toHaveLength(32);
    expect(lines.at(-1)).toBe("");
    expect(lines[0]).toBe(
      "﻿Registration code,Submitted (Dhaka),Status,Full name,Student ID,Department,Academic year,Email,Phone,Games,Total fee (BDT),Payment method,Transaction ID,Payment status,Reviewed (Dhaka),Rejection reason",
    );

    const pending = await buildExport("registrations", {
      status: "PENDING_REVIEW",
    });
    expect(pending.rowCount).toBe(3);
    const chess = await buildExport("registrations", { game: gameIds.Chess });
    expect(chess.rowCount).toBe(27);

    const players = await buildExport("participants", {
      game: gameIds.Chess,
    });
    expect(players.rowCount).toBe(27);
    // Pending Ludo players are not confirmed yet.
    expect(
      (await buildExport("participants", { game: gameIds.Ludo })).rowCount,
    ).toBe(0);

    const verified = await buildExport("payments", { status: "VERIFIED" });
    expect(verified.rowCount).toBe(27);
    expect(verified.csv).toContain(",50,VERIFIED,CONFIRMED,");

    await recordExport(admin.id, "registrations", all);
    const [entry] = await getDatabase()
      .select({ after: auditLogs.after })
      .from(auditLogs)
      .where(eq(auditLogs.action, "REPORT_EXPORTED"));
    expect(entry.after).toMatchObject({ kind: "registrations", rows: 30 });
  });

  it("export results and operator activity with readable details", async () => {
    const rows = await drawChess(2);
    const final = rows[0];
    await executeScoreCommand({
      actor: admin,
      matchId: final.id,
      clientEventId: randomUUID(),
      deviceTime: new Date(),
      command: { type: "START" },
    });
    await executeScoreCommand({
      actor: admin,
      matchId: final.id,
      clientEventId: randomUUID(),
      deviceTime: new Date(),
      command: {
        type: "FINALIZE",
        expectedVersion: 2,
        score: { winnerSeat: 1, draw: false },
      },
    });

    const results = await buildExport("results", {
      game: gameIds.Chess,
      status: "COMPLETED",
    });
    expect(results.rowCount).toBe(1);
    expect(results.csv).toContain(`${final.code},Completed`);
    expect(results.csv).toMatch(/1\. Student \d+/);

    const activity = await buildExport("activity", { staff: admin.id });
    expect(activity.rowCount).toBe(2);
    expect(activity.csv).toContain("Result confirmed");
    expect(activity.csv).toContain("Match started");
  });
});

describe("dashboard", () => {
  it("counts registrations, fees, entries and matches from the database", async () => {
    await drawChess(2);
    await submit(gameIds.Ludo);
    const reporter = await operatorWith({ type: "GAME", id: gameIds.Chess }, [
      "VIEW",
      "ISSUE_REPORT",
    ]);
    await reportIssue({ actor: reporter, report: report(null) });

    const dashboard = await getDashboard();
    expect(dashboard).toMatchObject({
      registrations: { pending: 1, confirmed: 2, rejected: 0, total: 3 },
      fees: { verifiedMinor: 10_000, awaitingMinor: 5_000 },
      confirmedEntries: 2,
      matches: { live: 0, scheduled: 1, finished: 0, total: 1 },
      staff: { operators: 1, assignments: 1 },
      issues: { open: 1 },
    });
    // Approval emails wait in the outbox until the after() send runs.
    expect(dashboard?.delivery.waiting).toBeGreaterThan(0);
  });
});

describe("live update signals", () => {
  it("send ids and versions only, on private channels", async () => {
    const rows = await drawChess(4);
    const semi = rows.find((row) => row.next)!;

    // Without the secret key nothing is sent.
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await signalMatchChange(semi.id, { version: 3 });
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    await signalMatchChange(semi.id, { version: 3, includeNext: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://127.0.0.1:54321/realtime/v1/api/broadcast");
    expect((init.headers as Record<string, string>).apikey).toBe(
      "sb_secret_test",
    );
    const body = JSON.parse(String(init.body));
    expect(body.messages).toEqual([
      {
        topic: `match:${semi.id}`,
        event: "changed",
        payload: { kind: "match", version: 3 },
        private: true,
      },
      {
        topic: `match:${semi.next}`,
        event: "changed",
        payload: { kind: "match" },
        private: true,
      },
      {
        topic: `tournament:${tournamentId}`,
        event: "changed",
        payload: { kind: "match", matchIds: [semi.id, semi.next] },
        private: true,
      },
    ]);

    // A failing Realtime service never breaks the caller.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(signalMatchChange(semi.id)).resolves.toBeUndefined();
  });
});

describe("issue table", () => {
  it("rejects a resolved report without a resolution time", async () => {
    const reporter = await operatorWith({ type: "GAME", id: gameIds.Chess }, [
      "VIEW",
      "ISSUE_REPORT",
    ]);
    const { id } = await reportIssue({
      actor: reporter,
      report: report(null),
    });
    await expect(
      getDatabase()
        .update(issueReports)
        .set({ status: "RESOLVED" })
        .where(eq(issueReports.id, id)),
    ).rejects.toThrow();
  });
});
