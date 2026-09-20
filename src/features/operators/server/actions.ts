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
  // One select carries the whole choice: scope type, tournament and target.
  const selected = String(formData.get("scope") ?? "").split("|");
  const scope = scopeType.safeParse(selected[0]);
  const tournamentId = id.safeParse(selected[1]);
  const targetId = selected[2] ? id.safeParse(selected[2]) : null;
  const level = accessLevel.safeParse(formData.get("accessLevel"));

  if (!operatorId.success) redirect("/admin/operators?error=invalid_operator");

  const base = `/admin/operators/${operatorId.data}`;

  if (
    !scope.success ||
    !tournamentId.success ||
    (targetId && !targetId.success) ||
    !level.success
  ) {
    redirect(`${base}?error=invalid_assignment`);
  }

  let destination = `${base}?message=assignment_granted`;

  try {
    const result = await grantOperatorAssignment({
      actorId: actor.id,
      operatorId: operatorId.data,
      tournamentId: tournamentId.data,
      scopeType: scope.data,
      targetId: targetId?.data ?? null,
      capabilities: capabilitiesForLevel(level.data),
    });
    revalidatePath(base);
    revalidatePath("/operator");
    if (result.replaced) destination = `${base}?message=assignment_updated`;
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
