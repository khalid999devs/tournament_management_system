import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDatabase } from "@/db";
import {
  auditLogs,
  matches,
  notifications,
  operatorAssignments,
  registrationGameEntries,
  registrations,
  rounds,
  staffProfiles,
  tournamentGames,
  tournaments,
} from "@/db/schema";
import type { OperatorCapability } from "@/db/schema/assignments";
import {
  capabilitiesForLevel,
  defaultAccessLevel,
} from "@/features/operators/domain/access-levels";
import { createAdminClient } from "@/lib/supabase/admin";

type ScopeType =
  "ALL_TOURNAMENT" | "GAME" | "ROUND" | "MATCH" | "PARTICIPANT_ENTRY";

export class OperatorManagementError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "OperatorManagementError";
  }
}

export async function createOperator(input: {
  actorId: string;
  email: string;
  displayName: string;
}) {
  const db = getDatabase();
  const existing = await db
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(sql`lower(${staffProfiles.email}) = ${input.email.toLowerCase()}`)
    .limit(1);

  if (existing.length) throw new OperatorManagementError("already_exists");

  const auth = createAdminClient().auth.admin;
  const invite = await auth.generateLink({
    type: "invite",
    email: input.email,
  });
  const link = invite.error
    ? await auth.generateLink({ type: "recovery", email: input.email })
    : invite;

  if (link.error || !link.data.user?.id || !link.data.properties.hashed_token) {
    throw new OperatorManagementError("auth_invite_failed");
  }

  const result = await db.transaction(async (tx) => {
    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        authUserId: link.data.user.id,
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        role: "SCORE_OPERATOR",
      })
      .returning({ id: staffProfiles.id });

    const [notification] = await tx
      .insert(notifications)
      .values({
        staffProfileId: profile.id,
        recipientEmail: input.email.toLowerCase(),
        type: "OPERATOR_INVITE",
        idempotencyKey: `operator-invite:${profile.id}`,
      })
      .returning({ id: notifications.id });

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "OPERATOR_CREATED",
      entityType: "staff_profile",
      entityId: profile.id,
      after: {
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        role: "SCORE_OPERATOR",
        active: true,
      },
    });

    return { profileId: profile.id, notificationId: notification.id };
  });

  return {
    ...result,
    tokenHash: link.data.properties.hashed_token,
    tokenType: invite.error ? ("recovery" as const) : ("invite" as const),
  };
}

export async function setOperatorActive(input: {
  actorId: string;
  operatorId: string;
  active: boolean;
}) {
  const db = getDatabase();

  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ id: staffProfiles.id, active: staffProfiles.active })
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.id, input.operatorId),
          eq(staffProfiles.role, "SCORE_OPERATOR"),
        ),
      )
      .limit(1)
      .for("update");

    if (!profile) throw new OperatorManagementError("operator_not_found");
    if (profile.active === input.active) return false;

    const now = new Date();
    await tx
      .update(staffProfiles)
      .set({ active: input.active, updatedAt: now })
      .where(eq(staffProfiles.id, profile.id));

    if (!input.active) {
      await tx
        .update(operatorAssignments)
        .set({ active: false, revokedBy: input.actorId, revokedAt: now })
        .where(
          and(
            eq(operatorAssignments.operatorId, profile.id),
            eq(operatorAssignments.active, true),
          ),
        );
    }

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: input.active ? "OPERATOR_REACTIVATED" : "OPERATOR_DEACTIVATED",
      entityType: "staff_profile",
      entityId: profile.id,
      before: { active: profile.active },
      after: { active: input.active, assignmentsRevoked: !input.active },
    });

    return true;
  });
}

export async function grantOperatorAssignment(input: {
  actorId: string;
  operatorId: string;
  tournamentId: string;
  scopeType: ScopeType;
  targetId: string | null;
  capabilities: OperatorCapability[];
}) {
  const db = getDatabase();

  return db.transaction(async (tx) => {
    const [operator] = await tx
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(
        and(
          eq(staffProfiles.id, input.operatorId),
          eq(staffProfiles.role, "SCORE_OPERATOR"),
          eq(staffProfiles.active, true),
        ),
      )
      .limit(1);

    if (!operator) throw new OperatorManagementError("operator_not_active");
    if (!(await targetBelongsToTournament(tx, input))) {
      throw new OperatorManagementError("scope_target_invalid");
    }

    const targetColumns = {
      tournamentGameId: input.scopeType === "GAME" ? input.targetId : null,
      roundId: input.scopeType === "ROUND" ? input.targetId : null,
      matchId: input.scopeType === "MATCH" ? input.targetId : null,
      registrationGameEntryId:
        input.scopeType === "PARTICIPANT_ENTRY" ? input.targetId : null,
    };
    const capabilities = Array.from(
      new Set(["VIEW" as const, ...input.capabilities]),
    );
    const [existing] = await tx
      .select({ id: operatorAssignments.id })
      .from(operatorAssignments)
      .where(
        and(
          eq(operatorAssignments.operatorId, operator.id),
          eq(operatorAssignments.scopeType, input.scopeType),
          eq(operatorAssignments.tournamentId, input.tournamentId),
          columnMatches(
            operatorAssignments.tournamentGameId,
            targetColumns.tournamentGameId,
          ),
          columnMatches(operatorAssignments.roundId, targetColumns.roundId),
          columnMatches(operatorAssignments.matchId, targetColumns.matchId),
          columnMatches(
            operatorAssignments.registrationGameEntryId,
            targetColumns.registrationGameEntryId,
          ),
        ),
      )
      .limit(1)
      .for("update");

    // The same operator and target may only hold one assignment, so a repeat
    // grant rewrites the capabilities and brings a revoked one back.
    const [assignment] = await tx
      .insert(operatorAssignments)
      .values({
        operatorId: operator.id,
        tournamentId: input.tournamentId,
        scopeType: input.scopeType,
        ...targetColumns,
        capabilities,
        grantedBy: input.actorId,
      })
      .onConflictDoUpdate({
        target: [
          operatorAssignments.operatorId,
          operatorAssignments.scopeType,
          operatorAssignments.tournamentId,
          operatorAssignments.tournamentGameId,
          operatorAssignments.roundId,
          operatorAssignments.matchId,
          operatorAssignments.registrationGameEntryId,
        ],
        set: {
          capabilities,
          active: true,
          grantedBy: input.actorId,
          revokedBy: null,
          revokedAt: null,
        },
      })
      .returning({ id: operatorAssignments.id });

    const replaced = Boolean(existing);

    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: replaced
        ? "OPERATOR_ASSIGNMENT_UPDATED"
        : "OPERATOR_ASSIGNMENT_GRANTED",
      entityType: "operator_assignment",
      entityId: assignment.id,
      after: {
        operatorId: input.operatorId,
        tournamentId: input.tournamentId,
        scopeType: input.scopeType,
        targetId: input.targetId,
        capabilities: input.capabilities,
      },
    });

    return { id: assignment.id, replaced };
  });
}

/**
 * The everyday move: hand an operator a whole game, or take it back. Turning a
 * game on gives the full scoring level, which an admin can narrow afterwards
 * on the operator's own page.
 */
export async function setOperatorGameAccess(input: {
  actorId: string;
  operatorId: string;
  tournamentId: string;
  tournamentGameId: string;
  enabled: boolean;
}) {
  if (input.enabled) {
    await grantOperatorAssignment({
      actorId: input.actorId,
      operatorId: input.operatorId,
      tournamentId: input.tournamentId,
      scopeType: "GAME",
      targetId: input.tournamentGameId,
      capabilities: capabilitiesForLevel(defaultAccessLevel),
    });
    return;
  }

  const [existing] = await getDatabase()
    .select({ id: operatorAssignments.id })
    .from(operatorAssignments)
    .where(
      and(
        eq(operatorAssignments.operatorId, input.operatorId),
        eq(operatorAssignments.scopeType, "GAME"),
        eq(operatorAssignments.tournamentGameId, input.tournamentGameId),
        eq(operatorAssignments.active, true),
      ),
    )
    .limit(1);

  if (!existing) return;

  await revokeOperatorAssignment({
    actorId: input.actorId,
    assignmentId: existing.id,
    operatorId: input.operatorId,
  });
}

export async function revokeOperatorAssignment(input: {
  actorId: string;
  assignmentId: string;
  operatorId: string;
}) {
  const db = getDatabase();

  return db.transaction(async (tx) => {
    const [assignment] = await tx
      .select({
        id: operatorAssignments.id,
        operatorId: operatorAssignments.operatorId,
        active: operatorAssignments.active,
      })
      .from(operatorAssignments)
      .where(
        and(
          eq(operatorAssignments.id, input.assignmentId),
          eq(operatorAssignments.operatorId, input.operatorId),
        ),
      )
      .limit(1)
      .for("update");

    if (!assignment) throw new OperatorManagementError("assignment_not_found");
    if (!assignment.active) return assignment.operatorId;

    await tx
      .update(operatorAssignments)
      .set({ active: false, revokedBy: input.actorId, revokedAt: new Date() })
      .where(eq(operatorAssignments.id, assignment.id));
    await tx.insert(auditLogs).values({
      actorStaffId: input.actorId,
      action: "OPERATOR_ASSIGNMENT_REVOKED",
      entityType: "operator_assignment",
      entityId: assignment.id,
      before: { active: true },
      after: { active: false },
    });

    return assignment.operatorId;
  });
}

type Transaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
>[0];

function columnMatches(column: PgColumn, value: string | null) {
  return value === null ? isNull(column) : eq(column, value);
}

async function targetBelongsToTournament(
  tx: Transaction,
  input: {
    tournamentId: string;
    scopeType: ScopeType;
    targetId: string | null;
  },
) {
  if (input.scopeType === "ALL_TOURNAMENT") {
    if (input.targetId) return false;
    const row = await tx
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.id, input.tournamentId))
      .limit(1);
    return row.length > 0;
  }

  if (!input.targetId) return false;

  switch (input.scopeType) {
    case "GAME": {
      const row = await tx
        .select({ id: tournamentGames.id })
        .from(tournamentGames)
        .where(
          and(
            eq(tournamentGames.id, input.targetId),
            eq(tournamentGames.tournamentId, input.tournamentId),
          ),
        )
        .limit(1);
      return row.length > 0;
    }
    case "ROUND": {
      const row = await tx
        .select({ id: rounds.id })
        .from(rounds)
        .innerJoin(
          tournamentGames,
          eq(rounds.tournamentGameId, tournamentGames.id),
        )
        .where(
          and(
            eq(rounds.id, input.targetId),
            eq(tournamentGames.tournamentId, input.tournamentId),
          ),
        )
        .limit(1);
      return row.length > 0;
    }
    case "MATCH": {
      const row = await tx
        .select({ id: matches.id })
        .from(matches)
        .innerJoin(rounds, eq(matches.roundId, rounds.id))
        .innerJoin(
          tournamentGames,
          eq(rounds.tournamentGameId, tournamentGames.id),
        )
        .where(
          and(
            eq(matches.id, input.targetId),
            eq(tournamentGames.tournamentId, input.tournamentId),
          ),
        )
        .limit(1);
      return row.length > 0;
    }
    case "PARTICIPANT_ENTRY": {
      const row = await tx
        .select({ id: registrationGameEntries.id })
        .from(registrationGameEntries)
        .innerJoin(
          registrations,
          eq(registrationGameEntries.registrationId, registrations.id),
        )
        .innerJoin(
          tournamentGames,
          eq(registrationGameEntries.tournamentGameId, tournamentGames.id),
        )
        .where(
          and(
            eq(registrationGameEntries.id, input.targetId),
            eq(tournamentGames.tournamentId, input.tournamentId),
            eq(registrations.tournamentId, input.tournamentId),
          ),
        )
        .limit(1);
      return row.length > 0;
    }
  }
}
