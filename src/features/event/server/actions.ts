"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperAdmin } from "@/features/auth/server/staff-session";
import {
  eventDetailsSchema,
  newTournamentGameSchema,
  paymentMethodSchema,
  tournamentGameSchema,
} from "@/features/event/domain/event-settings";
import { refreshPublicEvent } from "@/features/tournaments/server/get-registration-tournament";
import {
  addTournamentGame,
  archiveTournamentGame,
  changeTournamentStatus,
  createTournament,
  EventSettingsError,
  savePaymentMethod,
  updateEventDetails,
  updateTournamentGame,
} from "./manage-event";

const id = z.uuid();
const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "");

function afterEventChange() {
  refreshPublicEvent();
  revalidatePath("/admin", "layout");
}

function errorCode(error: unknown) {
  return error instanceof EventSettingsError ? error.code : "save_failed";
}

export async function createTournamentAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const input = z
    .object({
      name: z.string().trim().min(3).max(180),
      year: z.coerce.number().int().min(2020).max(2100),
    })
    .safeParse({ name: text(formData, "name"), year: text(formData, "year") });

  if (!input.success) redirect("/admin/event?error=invalid_details");

  let destination = "/admin/event?message=tournament_created";
  try {
    await createTournament({ actorId: actor.id, ...input.data });
    afterEventChange();
  } catch (error) {
    destination = `/admin/event?error=${errorCode(error)}`;
  }
  redirect(destination);
}

export async function updateEventDetailsAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const tournamentId = id.safeParse(formData.get("tournamentId"));
  const details = eventDetailsSchema.safeParse({
    name: text(formData, "name"),
    year: text(formData, "year"),
    venue: text(formData, "venue"),
    description: text(formData, "description"),
    checkInInstructions: text(formData, "checkInInstructions"),
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    registrationOpenAt: text(formData, "registrationOpenAt"),
    registrationCloseAt: text(formData, "registrationCloseAt"),
    maxGamesPerParticipant: text(formData, "maxGamesPerParticipant"),
    departments: text(formData, "departments"),
    academicYears: text(formData, "academicYears"),
    resultsEnabled: formData.get("resultsEnabled") === "on",
  });

  if (!tournamentId.success || !details.success) {
    const field = details.error?.issues[0]?.path[0];
    redirect(
      `/admin/event?error=invalid_details${field ? `&field=${String(field)}` : ""}`,
    );
  }

  let destination = "/admin/event?message=details_saved";
  try {
    await updateEventDetails({
      actorId: actor.id,
      tournamentId: tournamentId.data,
      details: details.data,
    });
    afterEventChange();
  } catch (error) {
    destination = `/admin/event?error=${errorCode(error)}`;
  }
  redirect(destination);
}

export async function changeTournamentStatusAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const tournamentId = id.safeParse(formData.get("tournamentId"));
  const status = z
    .enum([
      "REGISTRATION_OPEN",
      "REGISTRATION_CLOSED",
      "IN_PROGRESS",
      "COMPLETED",
      "ARCHIVED",
    ])
    .safeParse(formData.get("status"));

  if (!tournamentId.success || !status.success) {
    redirect("/admin/event?error=invalid_status_change");
  }

  let destination = "/admin/event?message=status_updated";
  try {
    await changeTournamentStatus({
      actorId: actor.id,
      tournamentId: tournamentId.data,
      status: status.data,
    });
    afterEventChange();
  } catch (error) {
    destination = `/admin/event?error=${errorCode(error)}`;
  }
  redirect(destination);
}

export async function savePaymentMethodAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const tournamentId = id.safeParse(formData.get("tournamentId"));
  const rawMethodId = text(formData, "paymentMethodId");
  const paymentMethodId = rawMethodId ? id.safeParse(rawMethodId) : null;
  const method = paymentMethodSchema.safeParse({
    displayName: text(formData, "displayName"),
    receivingAccount: text(formData, "receivingAccount"),
    instructions: text(formData, "instructions"),
    enabled: formData.get("enabled") === "on",
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (
    !tournamentId.success ||
    (paymentMethodId && !paymentMethodId.success) ||
    !method.success
  ) {
    redirect("/admin/event?error=invalid_payment_method#payments");
  }

  let destination = "/admin/event?message=payment_method_saved#payments";
  try {
    await savePaymentMethod({
      actorId: actor.id,
      tournamentId: tournamentId.data,
      paymentMethodId: paymentMethodId?.data ?? null,
      method: method.data,
    });
    afterEventChange();
  } catch (error) {
    destination = `/admin/event?error=${errorCode(error)}#payments`;
  }
  redirect(destination);
}

export async function addTournamentGameAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const tournamentId = id.safeParse(formData.get("tournamentId"));
  const game = newTournamentGameSchema.safeParse({
    name: text(formData, "name"),
    scoringAdapter: text(formData, "scoringAdapter"),
    feeTaka: text(formData, "feeTaka"),
    capacity: text(formData, "capacity"),
  });

  if (!tournamentId.success || !game.success) {
    redirect("/admin/games?error=invalid_game");
  }

  let destination = "/admin/games?error=save_failed";
  try {
    const created = await addTournamentGame({
      actorId: actor.id,
      tournamentId: tournamentId.data,
      ...game.data,
    });
    afterEventChange();
    destination = `/admin/games/${created}?message=game_added`;
  } catch (error) {
    destination = `/admin/games?error=${errorCode(error)}`;
  }
  redirect(destination);
}

export async function updateTournamentGameAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const tournamentGameId = id.safeParse(formData.get("tournamentGameId"));

  if (!tournamentGameId.success) redirect("/admin/games?error=game_not_found");

  const base = `/admin/games/${tournamentGameId.data}`;
  const config = tournamentGameSchema.safeParse({
    description: text(formData, "description"),
    feeTaka: text(formData, "feeTaka"),
    capacity: text(formData, "capacity"),
    scoringAdapter: text(formData, "scoringAdapter"),
    progressionMode: text(formData, "progressionMode"),
    availability: text(formData, "availability"),
    rules: text(formData, "rules"),
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (!config.success) redirect(`${base}?error=invalid_game`);

  let destination = `${base}?message=game_saved`;
  try {
    await updateTournamentGame({
      actorId: actor.id,
      tournamentGameId: tournamentGameId.data,
      config: config.data,
    });
    afterEventChange();
  } catch (error) {
    destination = `${base}?error=${errorCode(error)}`;
  }
  redirect(destination);
}

export async function archiveTournamentGameAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const tournamentGameId = id.safeParse(formData.get("tournamentGameId"));

  if (!tournamentGameId.success) redirect("/admin/games?error=game_not_found");

  let destination = "/admin/games?message=game_removed";
  try {
    await archiveTournamentGame({
      actorId: actor.id,
      tournamentGameId: tournamentGameId.data,
    });
    afterEventChange();
  } catch (error) {
    destination = `/admin/games/${tournamentGameId.data}?error=${errorCode(error)}`;
  }
  redirect(destination);
}
