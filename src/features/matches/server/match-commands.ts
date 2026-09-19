import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { getDatabase, type Database } from "@/db";
import {
  auditLogs,
  matchEntries,
  matches,
  matchUpdates,
  rounds,
  staffProfiles,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import type { OperatorCapability } from "@/db/schema/assignments";
import { operatorMatchAccessPredicate } from "@/features/operators/server/workload";
import {
  buildScoringContext,
  getScoringAdapter,
  type AnyScoringAdapter,
} from "@/features/scoring/adapters";
import {
  ScoringError,
  type CanonicalResult,
  type ScoringContext,
} from "@/features/scoring/domain/types";
import {
  finishedStatuses,
  replayScore,
  updateTypes,
  type MatchStatus,
  type ScoreCommand,
} from "../domain/commands";

export type MatchErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED_SCOPE"
  | "STALE_MATCH_VERSION"
  | "INVALID_SCORE"
  | "MATCH_CLOSED"
  | "NOT_READY"
  | "DOWNSTREAM_RESULT_DEPENDENCY"
  | "DUPLICATE_EVENT"
  | "EVENT_NOT_FOUND"
  | "REASON_REQUIRED";

export class MatchCommandError extends Error {
  constructor(
    readonly code: MatchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MatchCommandError";
  }
}

export type MatchActor = { id: string; role: "SUPER_ADMIN" | "SCORE_OPERATOR" };

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type LockedMatch = Awaited<ReturnType<typeof lockMatch>>;

const fail = (code: MatchErrorCode, message: string): never => {
  throw new MatchCommandError(code, message);
};

async function lockMatch(tx: Tx, matchId: string) {
  const [row] = await tx
    .select({
      id: matches.id,
      roundId: matches.roundId,
      code: matches.code,
      status: matches.status,
      version: matches.version,
      scoreData: matches.scoreData,
      resultData: matches.resultData,
      displayScore: matches.displayScore,
      startedAt: matches.startedAt,
      nextMatchId: matches.nextMatchId,
      nextMatchSeat: matches.nextMatchSeat,
      tournamentGameId: rounds.tournamentGameId,
      tournamentId: tournamentGames.tournamentId,
      tournamentStatus: tournaments.status,
      scoringAdapter: tournamentGames.scoringAdapter,
      scoringConfig: tournamentGames.config,
      progressionMode: tournamentGames.progressionMode,
    })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .innerJoin(tournaments, eq(tournamentGames.tournamentId, tournaments.id))
    .where(eq(matches.id, matchId))
    .limit(1)
    .for("update", { of: matches });

  return row ?? fail("NOT_FOUND", "This match no longer exists.");
}

// Access is re-checked inside the transaction, with the same predicate as the
// operator's match list, so a revoked assignment or deactivated account takes
// effect on the very next command.
async function authorize(
  tx: Tx,
  actor: MatchActor,
  matchId: string,
  capability: OperatorCapability,
) {
  const [profile] = await tx
    .select({ active: staffProfiles.active, role: staffProfiles.role })
    .from(staffProfiles)
    .where(eq(staffProfiles.id, actor.id))
    .limit(1);

  if (!profile?.active || profile.role !== actor.role) {
    fail("UNAUTHORIZED_SCOPE", "Your staff access has changed. Sign in again.");
  }
  if (actor.role === "SUPER_ADMIN") return;

  const [allowed] = await tx
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(rounds, eq(matches.roundId, rounds.id))
    .innerJoin(tournamentGames, eq(rounds.tournamentGameId, tournamentGames.id))
    .where(
      and(
        eq(matches.id, matchId),
        operatorMatchAccessPredicate(actor.id, capability, tx),
      ),
    )
    .limit(1);

  if (!allowed) {
    fail("UNAUTHORIZED_SCOPE", "You are not assigned to this match any more.");
  }
}

async function loadEntries(tx: Tx, matchId: string) {
  return tx
    .select({
      id: matchEntries.id,
      seat: matchEntries.seat,
      registrationGameEntryId: matchEntries.registrationGameEntryId,
    })
    .from(matchEntries)
    .where(eq(matchEntries.matchId, matchId))
    .orderBy(asc(matchEntries.seat));
}

async function pendingFeeders(tx: Tx, matchId: string) {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(
      and(
        eq(matches.nextMatchId, matchId),
        notInArray(matches.status, finishedStatuses),
      ),
    );
  return row?.count ?? 0;
}

async function appendUpdate(
  tx: Tx,
  input: {
    matchId: string;
    actorId: string;
    version: number;
    updateType: string;
    payload: Record<string, unknown>;
    clientEventId?: string;
    deviceTime?: Date | null;
    voidsUpdateId?: string | null;
  },
) {
  const [row] = await tx
    .insert(matchUpdates)
    .values({
      matchId: input.matchId,
      actorStaffId: input.actorId,
      updateType: input.updateType,
      matchVersion: input.version,
      payload: input.payload,
      clientEventId: input.clientEventId ?? randomUUID(),
      deviceTime: input.deviceTime ?? null,
      voidsUpdateId: input.voidsUpdateId ?? null,
    })
    .returning({ id: matchUpdates.id });
  return row.id;
}

function scoringError(error: unknown): never {
  if (error instanceof ScoringError) {
    fail(error.code, error.message);
  }
  throw error;
}

function parseScore(adapter: AnyScoringAdapter, raw: unknown) {
  const parsed = adapter.scoreSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    fail(
      "INVALID_SCORE",
      "The score is not in the expected format for this game.",
    );
  }
  return parsed.data;
}

type ScoringState = {
  adapter: AnyScoringAdapter;
  context: ScoringContext<unknown>;
  score: unknown;
};

function scoringState(
  match: LockedMatch,
  entries: { seat: number }[],
): ScoringState {
  const adapter = getScoringAdapter(match.scoringAdapter);
  const context = buildScoringContext({
    adapterKey: match.scoringAdapter,
    config: match.scoringConfig,
    seats: entries.map((entry) => entry.seat),
    progressionMode: match.progressionMode,
  });
  const score =
    match.scoreData === null || match.scoreData === undefined
      ? adapter.emptyScore(context)
      : parseScore(adapter, match.scoreData);
  return { adapter, context, score };
}

async function requireReady(
  tx: Tx,
  match: LockedMatch,
  entries: { seat: number }[],
  adapter: AnyScoringAdapter,
) {
  if (await pendingFeeders(tx, match.id)) {
    fail(
      "NOT_READY",
      "Waiting for an earlier match to finish before this one can be played.",
    );
  }
  if (
    entries.length < adapter.seats.min ||
    entries.length > adapter.seats.max
  ) {
    fail(
      "NOT_READY",
      entries.length < adapter.seats.min
        ? "Not every competitor is in this match yet. Record a walkover if someone will not play."
        : "This match has more competitors than the game allows.",
    );
  }
}

function requireVersion(match: LockedMatch, expected: number) {
  if (match.version !== expected) {
    fail(
      "STALE_MATCH_VERSION",
      "Someone else updated this match. Check the latest score and confirm again.",
    );
  }
}

async function markRoundProgress(tx: Tx, roundId: string) {
  const [open] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(
      and(
        eq(matches.roundId, roundId),
        notInArray(matches.status, finishedStatuses),
      ),
    );

  await tx
    .update(rounds)
    .set({
      status: (open?.count ?? 0) === 0 ? "COMPLETED" : "ACTIVE",
      updatedAt: new Date(),
    })
    .where(eq(rounds.id, roundId));
}

// Writes placements and, in automatic elimination, moves the winner into the
// next match. Locks are taken current match first, then the next match, so
// sibling matches finishing at once cannot deadlock.
async function writeResult(
  tx: Tx,
  match: LockedMatch,
  entries: Awaited<ReturnType<typeof loadEntries>>,
  result: CanonicalResult,
  status: "COMPLETED" | "WALKOVER",
  actorId: string,
  version: number,
  score: unknown,
) {
  const bySeat = new Map(entries.map((entry) => [entry.seat, entry]));
  const now = new Date();

  for (const entry of entries) {
    const placement = result.placements.find((row) => row.seat === entry.seat);
    await tx
      .update(matchEntries)
      .set({
        placement: placement?.placement ?? null,
        points: placement?.points ?? null,
        outcome: placement?.outcome ?? null,
        updatedAt: now,
      })
      .where(eq(matchEntries.id, entry.id));
  }

  const winnerEntryIds = result.winnerSeats.map(
    (seat) => bySeat.get(seat)!.registrationGameEntryId,
  );

  await tx
    .update(matches)
    .set({
      status,
      version,
      scoreData: score,
      displayScore: result.displayScore.slice(0, 160),
      resultData: {
        placements: result.placements.map((row) => ({
          ...row,
          registrationGameEntryId: bySeat.get(row.seat)!
            .registrationGameEntryId,
        })),
        winnerEntryIds,
        resultData: result.resultData,
      },
      startedAt: match.startedAt ?? now,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(matches.id, match.id));

  const automatic = match.progressionMode === "AUTOMATIC_SINGLE_ELIMINATION";
  if (automatic && match.nextMatchId && match.nextMatchSeat) {
    if (winnerEntryIds.length > 1) {
      fail("INVALID_SCORE", "A knockout match needs exactly one winner.");
    }
    if (winnerEntryIds.length === 1) {
      await advanceEntrant(tx, {
        fromMatchId: match.id,
        nextMatchId: match.nextMatchId,
        seat: match.nextMatchSeat,
        registrationGameEntryId: winnerEntryIds[0],
        actorId,
      });
    }
  }

  await markRoundProgress(tx, match.roundId);
  return winnerEntryIds;
}

async function lockNextMatch(tx: Tx, nextMatchId: string) {
  const [next] = await tx
    .select({
      id: matches.id,
      status: matches.status,
      version: matches.version,
      startedAt: matches.startedAt,
    })
    .from(matches)
    .where(eq(matches.id, nextMatchId))
    .limit(1)
    .for("update");
  return next ?? fail("NOT_FOUND", "The next match in the bracket is missing.");
}

async function advanceEntrant(
  tx: Tx,
  input: {
    fromMatchId: string;
    nextMatchId: string;
    seat: number;
    registrationGameEntryId: string;
    actorId: string;
  },
) {
  const next = await lockNextMatch(tx, input.nextMatchId);
  if (next.startedAt || !["SCHEDULED", "POSTPONED"].includes(next.status)) {
    fail("DOWNSTREAM_RESULT_DEPENDENCY", "The next match has already started.");
  }

  const [occupant] = await tx
    .select({ registrationGameEntryId: matchEntries.registrationGameEntryId })
    .from(matchEntries)
    .where(
      and(eq(matchEntries.matchId, next.id), eq(matchEntries.seat, input.seat)),
    )
    .limit(1);

  if (occupant) {
    if (occupant.registrationGameEntryId === input.registrationGameEntryId)
      return;
    fail(
      "DOWNSTREAM_RESULT_DEPENDENCY",
      "Another competitor already holds this place in the next match.",
    );
  }

  await tx.insert(matchEntries).values({
    matchId: next.id,
    registrationGameEntryId: input.registrationGameEntryId,
    seat: input.seat,
  });
  const version = next.version + 1;
  await tx
    .update(matches)
    .set({ version, updatedAt: new Date() })
    .where(eq(matches.id, next.id));
  await appendUpdate(tx, {
    matchId: next.id,
    actorId: input.actorId,
    version,
    updateType: updateTypes.ENTRANT_ADVANCED,
    payload: {
      fromMatchId: input.fromMatchId,
      registrationGameEntryId: input.registrationGameEntryId,
      seat: input.seat,
    },
  });
}

function capabilityFor(command: ScoreCommand): OperatorCapability {
  return command.type === "FINALIZE" || command.type === "WALKOVER"
    ? "FINALIZE_MATCH"
    : "SCORE_UPDATE";
}

async function withCommandTransaction<T>(run: (tx: Tx) => Promise<T>) {
  const db = getDatabase();
  // A deadlock or serialization failure is safe to retry once: nothing was
  // committed. Idempotency keys make the retry harmless in every other case.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        // Never hang an operator's phone: give up on a busy row after 5 s and
        // let the client retry with the same event id.
        await tx.execute(sql`set local lock_timeout = '5s'`);
        await tx.execute(sql`set local statement_timeout = '10s'`);
        return run(tx);
      });
    } catch (error) {
      const code =
        (error as { cause?: { code?: string }; code?: string })?.cause?.code ??
        (error as { code?: string })?.code;
      if (attempt < 2 && (code === "40P01" || code === "40001")) continue;
      throw error;
    }
  }
}

export type CommandOutcome = { duplicate: boolean; version: number };

export async function executeScoreCommand(input: {
  actor: MatchActor;
  matchId: string;
  clientEventId: string;
  deviceTime: Date | null;
  command: ScoreCommand;
}): Promise<CommandOutcome> {
  const { actor, command } = input;

  return withCommandTransaction(async (tx) => {
    const match = await lockMatch(tx, input.matchId);
    await authorize(tx, actor, match.id, capabilityFor(command));

    // The row lock above serializes writers, so this read sees any earlier
    // attempt of the same command that committed.
    const [existing] = await tx
      .select({ matchId: matchUpdates.matchId })
      .from(matchUpdates)
      .where(eq(matchUpdates.clientEventId, input.clientEventId))
      .limit(1);
    if (existing) {
      if (existing.matchId !== match.id) {
        fail(
          "DUPLICATE_EVENT",
          "This action id was already used for another match.",
        );
      }
      return { duplicate: true, version: match.version };
    }

    // A command built on an older view is reported as stale first, whatever
    // happened since, so the operator is always shown the newer state.
    if ("expectedVersion" in command)
      requireVersion(match, command.expectedVersion);

    if (["COMPLETED", "ARCHIVED"].includes(match.tournamentStatus)) {
      fail("MATCH_CLOSED", "The tournament is closed for scoring.");
    }
    const status = match.status as MatchStatus;
    if (!["SCHEDULED", "IN_PROGRESS"].includes(status)) {
      fail(
        "MATCH_CLOSED",
        status === "POSTPONED"
          ? "This match is postponed. An admin must resume it first."
          : "This match is closed. Ask an admin to reopen it for corrections.",
      );
    }

    const entries = await loadEntries(tx, match.id);
    const { adapter, context, score } = scoringState(match, entries);
    const version = match.version + 1;
    const now = new Date();
    const base = {
      matchId: match.id,
      actorId: actor.id,
      version,
      clientEventId: input.clientEventId,
      deviceTime: input.deviceTime,
    };

    const saveLive = async (nextScore: unknown) => {
      await tx
        .update(matches)
        .set({
          status: "IN_PROGRESS",
          version,
          scoreData: nextScore,
          displayScore: adapter.display(nextScore, context).slice(0, 160),
          startedAt: match.startedAt ?? now,
          updatedAt: now,
        })
        .where(eq(matches.id, match.id));
      if (status === "SCHEDULED") await markRoundProgress(tx, match.roundId);
    };

    switch (command.type) {
      case "START": {
        if (status === "IN_PROGRESS")
          return { duplicate: false, version: match.version };
        await requireReady(tx, match, entries, adapter);
        await appendUpdate(tx, {
          ...base,
          updateType: updateTypes.STARTED,
          payload: {},
        });
        await saveLive(score);
        break;
      }

      case "EVENT": {
        await requireReady(tx, match, entries, adapter);
        if (!adapter.eventSchema) {
          fail("INVALID_SCORE", "This game records only a final result.");
        }
        const event = adapter.eventSchema!.safeParse(command.event);
        if (!event.success)
          fail(
            "INVALID_SCORE",
            "That score action is not valid for this game.",
          );
        let nextScore: unknown;
        try {
          nextScore = adapter.applyEvent(score, event.data, context);
        } catch (error) {
          scoringError(error);
        }
        await appendUpdate(tx, {
          ...base,
          updateType: updateTypes.SCORE_EVENT,
          payload: { event: event.data },
        });
        await saveLive(nextScore);
        break;
      }

      case "VOID": {
        const [target] = await tx
          .select({
            id: matchUpdates.id,
            matchId: matchUpdates.matchId,
            updateType: matchUpdates.updateType,
          })
          .from(matchUpdates)
          .where(eq(matchUpdates.id, command.updateId))
          .limit(1);
        if (
          !target ||
          target.matchId !== match.id ||
          target.updateType !== updateTypes.SCORE_EVENT
        ) {
          fail("EVENT_NOT_FOUND", "That score action cannot be undone.");
        }
        const [alreadyVoided] = await tx
          .select({ id: matchUpdates.id })
          .from(matchUpdates)
          .where(eq(matchUpdates.voidsUpdateId, command.updateId))
          .limit(1);
        if (alreadyVoided)
          fail("EVENT_NOT_FOUND", "That score action was already undone.");

        const log = await tx
          .select({
            id: matchUpdates.id,
            updateType: matchUpdates.updateType,
            payload: matchUpdates.payload,
          })
          .from(matchUpdates)
          .where(eq(matchUpdates.matchId, match.id))
          .orderBy(asc(matchUpdates.matchVersion));
        let nextScore: unknown;
        try {
          nextScore = replayScore(adapter, context, [
            ...log,
            {
              id: "pending",
              updateType: updateTypes.SCORE_VOIDED,
              payload: { updateId: command.updateId },
            },
          ]);
        } catch (error) {
          if (error instanceof ScoringError) {
            fail(
              "INVALID_SCORE",
              `Undoing this would leave an impossible score (${error.message}) Correct the score directly instead.`,
            );
          }
          throw error;
        }
        await appendUpdate(tx, {
          ...base,
          updateType: updateTypes.SCORE_VOIDED,
          payload: { updateId: command.updateId },
          voidsUpdateId: command.updateId,
        });
        await saveLive(nextScore);
        break;
      }

      case "SET_SCORE": {
        requireVersion(match, command.expectedVersion);
        await requireReady(tx, match, entries, adapter);
        const nextScore = parseScore(adapter, command.score);
        try {
          adapter.validateScore(nextScore, context);
        } catch (error) {
          scoringError(error);
        }
        await appendUpdate(tx, {
          ...base,
          updateType: updateTypes.SCORE_SET,
          payload: { score: nextScore, previous: score },
        });
        await saveLive(nextScore);
        break;
      }

      case "FINALIZE": {
        requireVersion(match, command.expectedVersion);
        await requireReady(tx, match, entries, adapter);
        const finalScore =
          command.score === undefined
            ? score
            : parseScore(adapter, command.score);
        let result: CanonicalResult;
        try {
          result = adapter.finalize(finalScore, context);
        } catch (error) {
          scoringError(error);
        }
        await appendUpdate(tx, {
          ...base,
          updateType: updateTypes.FINALIZED,
          payload: {
            ...(command.score === undefined ? {} : { score: finalScore }),
            placements: result!.placements,
            displayScore: result!.displayScore,
          },
        });
        const winners = await writeResult(
          tx,
          match,
          entries,
          result!,
          "COMPLETED",
          actor.id,
          version,
          finalScore,
        );
        await tx.insert(auditLogs).values({
          actorStaffId: actor.id,
          action: "MATCH_FINALIZED",
          entityType: "match",
          entityId: match.id,
          after: {
            displayScore: result!.displayScore,
            winnerEntryIds: winners,
            version,
          },
        });
        break;
      }

      case "WALKOVER": {
        requireVersion(match, command.expectedVersion);
        if (await pendingFeeders(tx, match.id)) {
          fail("NOT_READY", "Waiting for an earlier match to finish.");
        }
        const seats = entries.map((entry) => entry.seat);
        const absent = [...new Set(command.absentSeats)];
        if (absent.some((seat) => !seats.includes(seat))) {
          fail("INVALID_SCORE", "Pick competitors who are in this match.");
        }
        const present = seats.filter((seat) => !absent.includes(seat));
        if (present.length > 1) {
          fail(
            "INVALID_SCORE",
            "More than one competitor is present, so the match must be played and scored.",
          );
        }
        const result: CanonicalResult = {
          placements: [
            ...present.map((seat) => ({
              seat,
              placement: 1,
              outcome: "WIN" as const,
            })),
            ...absent.map((seat) => ({
              seat,
              placement: present.length + 1,
              outcome: "DNS" as const,
            })),
          ],
          winnerSeats: present,
          displayScore: present.length ? "Walkover" : "No-show",
          resultData: {
            walkover: true,
            absentSeats: absent,
            note: command.note ?? null,
          },
        };
        await appendUpdate(tx, {
          ...base,
          updateType: updateTypes.WALKOVER,
          payload: { absentSeats: absent, note: command.note ?? null },
        });
        const winners = await writeResult(
          tx,
          match,
          entries,
          result,
          "WALKOVER",
          actor.id,
          version,
          score,
        );
        await tx.insert(auditLogs).values({
          actorStaffId: actor.id,
          action: "MATCH_WALKOVER",
          entityType: "match",
          entityId: match.id,
          after: { absentSeats: absent, winnerEntryIds: winners, version },
          reason: command.note ?? null,
        });
        break;
      }
    }

    return { duplicate: false, version };
  });
}

// ---------------------------------------------------------------------------
// Admin-only lifecycle commands

async function adminTransaction<T>(
  actor: MatchActor,
  matchId: string,
  run: (tx: Tx, match: LockedMatch) => Promise<T>,
) {
  if (actor.role !== "SUPER_ADMIN") {
    fail("UNAUTHORIZED_SCOPE", "Only an admin can do this.");
  }
  return withCommandTransaction(async (tx) => {
    const match = await lockMatch(tx, matchId);
    await authorize(tx, actor, match.id, "VIEW");
    return run(tx, match);
  });
}

function requireReason(reason: string | undefined) {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 5)
    fail("REASON_REQUIRED", "Enter a reason of at least 5 characters.");
  return trimmed.slice(0, 500);
}

// Reopening undoes the result so it can be corrected. If the winner already
// moved on, they are withdrawn from the next match, but only while that
// match has not started; otherwise the correction would silently rewrite a
// later result.
export async function reopenMatch(input: {
  actor: MatchActor;
  matchId: string;
  reason: string;
}) {
  const reason = requireReason(input.reason);
  return adminTransaction(input.actor, input.matchId, async (tx, match) => {
    if (!["COMPLETED", "WALKOVER"].includes(match.status)) {
      fail("MATCH_CLOSED", "Only a completed match can be reopened.");
    }
    const previous = match.resultData as { winnerEntryIds?: string[] } | null;
    const winners = previous?.winnerEntryIds ?? [];

    if (
      match.progressionMode === "AUTOMATIC_SINGLE_ELIMINATION" &&
      match.nextMatchId &&
      winners.length > 0
    ) {
      const next = await lockNextMatch(tx, match.nextMatchId);
      if (next.startedAt || !["SCHEDULED", "POSTPONED"].includes(next.status)) {
        fail(
          "DOWNSTREAM_RESULT_DEPENDENCY",
          "The next match has already started. Reopen that match first.",
        );
      }
      const removed = await tx
        .delete(matchEntries)
        .where(
          and(
            eq(matchEntries.matchId, next.id),
            inArray(matchEntries.registrationGameEntryId, winners),
          ),
        )
        .returning({ id: matchEntries.id });
      if (removed.length > 0) {
        const nextVersion = next.version + 1;
        await tx
          .update(matches)
          .set({ version: nextVersion, updatedAt: new Date() })
          .where(eq(matches.id, next.id));
        await appendUpdate(tx, {
          matchId: next.id,
          actorId: input.actor.id,
          version: nextVersion,
          updateType: updateTypes.ENTRANT_WITHDRAWN,
          payload: {
            fromMatchId: match.id,
            registrationGameEntryIds: winners,
            reason,
          },
        });
      }
    }

    const version = match.version + 1;
    await tx
      .update(matchEntries)
      .set({
        placement: null,
        points: null,
        outcome: null,
        updatedAt: new Date(),
      })
      .where(eq(matchEntries.matchId, match.id));
    await appendUpdate(tx, {
      matchId: match.id,
      actorId: input.actor.id,
      version,
      updateType: updateTypes.REOPENED,
      payload: {
        reason,
        previousResult: match.resultData,
        previousStatus: match.status,
      },
    });
    await tx
      .update(matches)
      .set({
        status: "IN_PROGRESS",
        version,
        resultData: null,
        completedAt: null,
        startedAt: match.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(matches.id, match.id));
    await markRoundProgress(tx, match.roundId);
    await tx.insert(auditLogs).values({
      actorStaffId: input.actor.id,
      action: "MATCH_REOPENED",
      entityType: "match",
      entityId: match.id,
      before: {
        status: match.status,
        displayScore: match.displayScore,
        result: match.resultData,
      },
      after: { status: "IN_PROGRESS", version },
      reason,
    });
    return { version };
  });
}

export async function postponeMatch(input: {
  actor: MatchActor;
  matchId: string;
  reason: string;
}) {
  const reason = requireReason(input.reason);
  return adminTransaction(input.actor, input.matchId, async (tx, match) => {
    if (!["SCHEDULED", "IN_PROGRESS"].includes(match.status)) {
      fail("MATCH_CLOSED", "Only a scheduled or live match can be postponed.");
    }
    const version = match.version + 1;
    await appendUpdate(tx, {
      matchId: match.id,
      actorId: input.actor.id,
      version,
      updateType: updateTypes.POSTPONED,
      payload: { reason, previousStatus: match.status },
    });
    await tx
      .update(matches)
      .set({ status: "POSTPONED", version, updatedAt: new Date() })
      .where(eq(matches.id, match.id));
    await tx.insert(auditLogs).values({
      actorStaffId: input.actor.id,
      action: "MATCH_POSTPONED",
      entityType: "match",
      entityId: match.id,
      before: { status: match.status },
      after: { status: "POSTPONED" },
      reason,
    });
    return { version };
  });
}

export async function resumeMatch(input: {
  actor: MatchActor;
  matchId: string;
}) {
  return adminTransaction(input.actor, input.matchId, async (tx, match) => {
    if (match.status !== "POSTPONED")
      fail("MATCH_CLOSED", "This match is not postponed.");
    const status = match.startedAt ? "IN_PROGRESS" : "SCHEDULED";
    const version = match.version + 1;
    await appendUpdate(tx, {
      matchId: match.id,
      actorId: input.actor.id,
      version,
      updateType: updateTypes.RESUMED,
      payload: { status },
    });
    await tx
      .update(matches)
      .set({ status, version, updatedAt: new Date() })
      .where(eq(matches.id, match.id));
    await tx.insert(auditLogs).values({
      actorStaffId: input.actor.id,
      action: "MATCH_RESUMED",
      entityType: "match",
      entityId: match.id,
      before: { status: "POSTPONED" },
      after: { status },
    });
    return { version };
  });
}

// Cancelling would break an elimination bracket, so it is limited to
// manually progressed games; knockout no-shows are recorded as walkovers.
export async function cancelMatch(input: {
  actor: MatchActor;
  matchId: string;
  reason: string;
}) {
  const reason = requireReason(input.reason);
  return adminTransaction(input.actor, input.matchId, async (tx, match) => {
    if (match.progressionMode !== "MANUAL") {
      fail(
        "MATCH_CLOSED",
        "Knockout matches cannot be cancelled. Record a walkover instead.",
      );
    }
    if (!["SCHEDULED", "IN_PROGRESS", "POSTPONED"].includes(match.status)) {
      fail("MATCH_CLOSED", "This match is already closed.");
    }
    const version = match.version + 1;
    await appendUpdate(tx, {
      matchId: match.id,
      actorId: input.actor.id,
      version,
      updateType: updateTypes.CANCELLED,
      payload: { reason, previousStatus: match.status },
    });
    await tx
      .update(matches)
      .set({
        status: "CANCELLED",
        version,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(matches.id, match.id));
    await markRoundProgress(tx, match.roundId);
    await tx.insert(auditLogs).values({
      actorStaffId: input.actor.id,
      action: "MATCH_CANCELLED",
      entityType: "match",
      entityId: match.id,
      before: { status: match.status },
      after: { status: "CANCELLED" },
      reason,
    });
    return { version };
  });
}

// Schedule and location are operational metadata: they never touch the
// score, so they do not bump the match version or make open screens stale.
export async function updateMatchSchedule(input: {
  actor: MatchActor;
  matchId: string;
  scheduledAt: Date | null;
  venue: string | null;
  station: string | null;
}) {
  return adminTransaction(input.actor, input.matchId, async (tx, match) => {
    const [before] = await tx
      .select({
        scheduledAt: matches.scheduledAt,
        venue: matches.venue,
        station: matches.station,
      })
      .from(matches)
      .where(eq(matches.id, match.id));
    await tx
      .update(matches)
      .set({
        scheduledAt: input.scheduledAt,
        venue: input.venue,
        station: input.station,
        updatedAt: new Date(),
      })
      .where(eq(matches.id, match.id));
    await tx.insert(auditLogs).values({
      actorStaffId: input.actor.id,
      action: "MATCH_SCHEDULE_CHANGED",
      entityType: "match",
      entityId: match.id,
      before,
      after: {
        scheduledAt: input.scheduledAt,
        venue: input.venue,
        station: input.station,
      },
    });
  });
}
