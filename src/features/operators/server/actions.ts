"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/features/auth/server/staff-session";
import {
  capabilitiesForLevel,
  type AccessLevel,
} from "@/features/operators/domain/access-levels";
import { processOperatorInvite } from "./process-invite";
import {
  createOperator,
  grantOperatorAssignment,
  OperatorManagementError,
  revokeOperatorAssignment,
  setOperatorActive,
  setOperatorGameAccess,
} from "./manage-operators";

const id = z.uuid();
const createSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(160),
});
const scopeType = z.enum([
  "ALL_TOURNAMENT",
  "GAME",
  "ROUND",
  "MATCH",
  "PARTICIPANT_ENTRY",
]);
const accessLevel = z.enum([
  "SCORE_AND_CONFIRM",
  "SCORE_ONLY",
  "WATCH",
] as const satisfies readonly AccessLevel[]);

export async function createOperatorAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const input = createSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
  });

  if (!input.success) redirect("/admin/operators?error=invalid_details");

  let destination = "/admin/operators?error=create_failed";

  try {
    const result = await createOperator({ actorId: actor.id, ...input.data });
    after(() =>
      processOperatorInvite(
        result.notificationId,
        result.tokenHash,
        result.tokenType,
      ),
    );
    revalidatePath("/admin/operators");
    destination = `/admin/operators/${result.profileId}?message=created`;
  } catch (error) {
    destination = `/admin/operators?error=${errorCode(error)}`;
  }

  redirect(destination);
}

export async function setOperatorActiveAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const operatorId = id.safeParse(formData.get("operatorId"));
  const active = formData.get("active") === "true";

  if (!operatorId.success) redirect("/admin/operators?error=invalid_operator");

  let destination = `/admin/operators/${operatorId.data}?message=${active ? "reactivated" : "deactivated"}`;

  try {
    await setOperatorActive({
      actorId: actor.id,
      operatorId: operatorId.data,
      active,
    });
    revalidatePath("/admin/operators");
    revalidatePath(`/admin/operators/${operatorId.data}`);
    revalidatePath("/operator");
  } catch (error) {
    destination = `/admin/operators/${operatorId.data}?error=${errorCode(error)}`;
  }

  redirect(destination);
}

export async function grantAssignmentAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const operatorId = id.safeParse(formData.get("operatorId"));
  const level = accessLevel.safeParse(formData.get("accessLevel"));

  if (!operatorId.success) redirect("/admin/operators?error=invalid_operator");

  const base = `/admin/operators/${operatorId.data}`;

  // One target per "scope" value: scope type, tournament and target id. The
  // player picker sends several at once.
  const targets = formData
    .getAll("scope")
    .map((value) => String(value).split("|"))
    .map((parts) => ({
      scope: scopeType.safeParse(parts[0]),
      tournamentId: id.safeParse(parts[1]),
      targetId: parts[2] ? id.safeParse(parts[2]) : null,
    }));

  if (
    !level.success ||
    targets.length === 0 ||
    targets.some(
      (target) =>
        !target.scope.success ||
        !target.tournamentId.success ||
        (target.targetId && !target.targetId.success),
    )
  ) {
    redirect(`${base}?error=invalid_assignment`);
  }

  let destination = `${base}?message=assignment_granted`;

  try {
    let replaced = 0;
    for (const target of targets) {
      const result = await grantOperatorAssignment({
        actorId: actor.id,
        operatorId: operatorId.data,
        tournamentId: target.tournamentId.data!,
        scopeType: target.scope.data!,
        targetId: target.targetId?.data ?? null,
        capabilities: capabilitiesForLevel(level.data),
      });
      if (result.replaced) replaced += 1;
    }
    revalidatePath(base);
    revalidatePath("/operator");

    if (targets.length > 1) {
      destination = `${base}?message=assignments_granted&count=${targets.length}`;
    } else if (replaced === 1) {
      destination = `${base}?message=assignment_updated`;
    }
  } catch (error) {
    destination = `${base}?error=${errorCode(error)}`;
  }

  redirect(destination);
}

export async function setGameAccessAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const operatorId = id.safeParse(formData.get("operatorId"));
  const tournamentId = id.safeParse(formData.get("tournamentId"));
  const tournamentGameId = id.safeParse(formData.get("tournamentGameId"));
  const enabled = formData.get("enabled") === "true";

  if (
    !operatorId.success ||
    !tournamentId.success ||
    !tournamentGameId.success
  ) {
    redirect("/admin/operators?error=invalid_assignment");
  }

  let destination = `/admin/operators?message=${enabled ? "game_added" : "game_removed"}`;

  try {
    await setOperatorGameAccess({
      actorId: actor.id,
      operatorId: operatorId.data,
      tournamentId: tournamentId.data,
      tournamentGameId: tournamentGameId.data,
      enabled,
    });
    revalidatePath("/admin/operators");
    revalidatePath(`/admin/operators/${operatorId.data}`);
    revalidatePath("/operator");
  } catch (error) {
    destination = `/admin/operators?error=${errorCode(error)}`;
  }

  redirect(destination);
}

export async function revokeAssignmentAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const assignmentId = id.safeParse(formData.get("assignmentId"));
  const operatorId = id.safeParse(formData.get("operatorId"));

  if (!assignmentId.success || !operatorId.success) {
    redirect("/admin/operators?error=invalid_assignment");
  }

  const base = `/admin/operators/${operatorId.data}`;
  let destination = `${base}?message=assignment_revoked`;

  try {
    const ownerId = await revokeOperatorAssignment({
      actorId: actor.id,
      assignmentId: assignmentId.data,
      operatorId: operatorId.data,
    });
    if (ownerId === operatorId.data) {
      revalidatePath(base);
      revalidatePath("/operator");
    }
  } catch (error) {
    destination = `${base}?error=${errorCode(error)}`;
  }

  redirect(destination);
}

function errorCode(error: unknown) {
  return error instanceof OperatorManagementError
    ? error.code
    : "operation_failed";
}
