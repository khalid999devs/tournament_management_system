import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditLogs,
  notifications,
  payments,
  registrationGameEntries,
  registrations,
  tournamentGames,
} from "@/db/schema";
import {
  RegistrationReviewError,
  reviewRegistration,
} from "@/features/admin/server/review-registration";
import { RegistrationDomainError } from "@/features/registration/domain/errors";
import { submitRegistration } from "@/features/registration/server/submit-registration";
import {
  createStaff,
  registrationInput,
  resetDatabase,
  seedOpenEvent,
} from "./helpers";

async function gameCounts(id: string) {
  const [game] = await getDatabase()
    .select({
      reserved: tournamentGames.reservedCount,
      confirmed: tournamentGames.confirmedCount,
    })
    .from(tournamentGames)
    .where(eq(tournamentGames.id, id));
  return game;
}

async function registrationId(code: string) {
  const [row] = await getDatabase()
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.code, code));
  return row.id;
}

describe("registration submission", () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDatabase();
    adminId = await createStaff("SUPER_ADMIN");
  });

  it("lets exactly one of two simultaneous students take the last place", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId, {
      Chess: 1,
    });

    const results = await Promise.allSettled([
      submitRegistration(registrationInput(tournamentId, [gameIds.Chess])),
      submitRegistration(registrationInput(tournamentId, [gameIds.Chess])),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(RegistrationDomainError);
    expect(rejected[0].reason.code).toBe("GAME_FULL");
    expect(await gameCounts(gameIds.Chess)).toEqual({
      reserved: 1,
      confirmed: 0,
    });

    const rows = await getDatabase().select().from(registrations);
    expect(rows).toHaveLength(1);
  });

  it("creates the registration, entries, payment, receipt and audit together", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId, {
      Chess: 4,
      Carrom: 4,
    });

    const result = await submitRegistration(
      registrationInput(tournamentId, [gameIds.Chess, gameIds.Carrom]),
    );
    const id = await registrationId(result.registrationCode);
    const db = getDatabase();

    const [registration] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, id));
    const entries = await db
      .select()
      .from(registrationGameEntries)
      .where(eq(registrationGameEntries.registrationId, id));
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, id));
    const receipts = await db
      .select()
      .from(notifications)
      .where(eq(notifications.registrationId, id));

    expect(registration.status).toBe("PENDING_REVIEW");
    expect(registration.totalFeeMinor).toBe(10_000);
    expect(entries.map((entry) => entry.status)).toEqual([
      "PENDING",
      "PENDING",
    ]);
    expect(payment.receivingAccountSnapshot).toBe("01700000000");
    expect(receipts.map((receipt) => receipt.type)).toEqual([
      "REGISTRATION_SUBMITTED",
    ]);
    expect(await gameCounts(gameIds.Chess)).toEqual({
      reserved: 1,
      confirmed: 0,
    });
  });

  it("returns the same registration when the same submission is retried", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId);
    const input = registrationInput(tournamentId, [gameIds.Chess]);

    const first = await submitRegistration(input);
    const retry = await submitRegistration(input);

    expect(retry.registrationCode).toBe(first.registrationCode);
    expect(retry.reused).toBe(true);
    expect(await gameCounts(gameIds.Chess)).toEqual({
      reserved: 1,
      confirmed: 0,
    });
  });

  it("blocks a transaction ID reused with different spacing or case", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId);

    await submitRegistration(
      registrationInput(tournamentId, [gameIds.Chess], {
        transactionId: "ab12 cd34",
      }),
    );

    await expect(
      submitRegistration(
        registrationInput(tournamentId, [gameIds.Chess], {
          transactionId: "AB12CD34",
        }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_TRANSACTION" });
  });

  it("blocks a second active registration from the same student", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId);

    await submitRegistration(
      registrationInput(tournamentId, [gameIds.Chess], {
        studentId: "1901001",
      }),
    );

    await expect(
      submitRegistration(
        registrationInput(tournamentId, [gameIds.Chess], {
          studentId: "1901001",
        }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_REGISTRATION" });
  });

  it("rejects a department that is not in the configured list", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId);

    await expect(
      submitRegistration(
        registrationInput(tournamentId, [gameIds.Chess], {
          department: "Made-up Department",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_SUBMISSION" });
  });
});

describe("registration review", () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDatabase();
    adminId = await createStaff("SUPER_ADMIN");
  });

  it("approves every related record at once and is safe to repeat", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId);
    const { registrationCode } = await submitRegistration(
      registrationInput(tournamentId, [gameIds.Chess]),
    );
    const id = await registrationId(registrationCode);

    await reviewRegistration({
      registrationId: id,
      decision: "APPROVE",
      actorStaffId: adminId,
    });
    const repeat = await reviewRegistration({
      registrationId: id,
      decision: "APPROVE",
      actorStaffId: adminId,
    });

    const db = getDatabase();
    const [registration] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, id));
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, id));
    const [entry] = await db
      .select()
      .from(registrationGameEntries)
      .where(eq(registrationGameEntries.registrationId, id));
    const approvals = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "REGISTRATION_APPROVED"));

    expect(repeat.idempotent).toBe(true);
    expect(registration.status).toBe("CONFIRMED");
    expect(payment.status).toBe("VERIFIED");
    expect(entry.status).toBe("CONFIRMED");
    expect(approvals).toHaveLength(1);
    expect(await gameCounts(gameIds.Chess)).toEqual({
      reserved: 0,
      confirmed: 1,
    });
  });

  it("handles a double-clicked approval without double counting", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId);
    const { registrationCode } = await submitRegistration(
      registrationInput(tournamentId, [gameIds.Chess]),
    );
    const id = await registrationId(registrationCode);
    const approve = () =>
      reviewRegistration({
        registrationId: id,
        decision: "APPROVE",
        actorStaffId: adminId,
      });

    await Promise.all([approve(), approve()]);

    expect(await gameCounts(gameIds.Chess)).toEqual({
      reserved: 0,
      confirmed: 1,
    });
  });

  it("rejects with a reason, frees the place, and allows a new attempt", async () => {
    const { tournamentId, gameIds } = await seedOpenEvent(adminId, {
      Chess: 1,
    });
    const { registrationCode } = await submitRegistration(
      registrationInput(tournamentId, [gameIds.Chess], {
        studentId: "1901099",
      }),
    );
    const id = await registrationId(registrationCode);

    await expect(
      reviewRegistration({
        registrationId: id,
        decision: "REJECT",
        actorStaffId: adminId,
      }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });

    await reviewRegistration({
      registrationId: id,
      decision: "REJECT",
      reason: "Transaction ID not found.",
      actorStaffId: adminId,
    });

    expect(await gameCounts(gameIds.Chess)).toEqual({
      reserved: 0,
      confirmed: 0,
    });

    await expect(
      reviewRegistration({
        registrationId: id,
        decision: "APPROVE",
        actorStaffId: adminId,
      }),
    ).rejects.toBeInstanceOf(RegistrationReviewError);

    const second = await submitRegistration(
      registrationInput(tournamentId, [gameIds.Chess], {
        studentId: "1901099",
      }),
    );
    expect(second.registrationCode).not.toBe(registrationCode);
    expect(await gameCounts(gameIds.Chess)).toEqual({
      reserved: 1,
      confirmed: 0,
    });
  });
});
