"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/features/auth/server/staff-session";
import { dhakaInputToDate } from "@/features/event/domain/event-settings";
import {
  EventSettingsError,
  updateScoringRules,
} from "@/features/event/server/manage-event";
import { scoringRulesSchema } from "@/features/event/domain/event-settings";
import { getScoringAdapter } from "@/features/scoring/adapters";
import { configFromForm } from "@/features/scoring/domain/config-form";
import {
  addManualMatch,
  addRound,
  BracketError,
  deleteManualMatch,
  generateBracket,
  resetBracket,
} from "./manage-brackets";
import {
  cancelMatch,
  MatchCommandError,
  postponeMatch,
  reopenMatch,
  resumeMatch,
  updateMatchSchedule,
} from "./match-commands";
import {
  signalMatchChange,
  signalTournamentChange,
} from "@/lib/realtime/signal";
import { refreshPublicResults } from "./public-results";

const id = z.uuid();
const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "");

function errorCode(error: unknown) {
  if (error instanceof BracketError || error instanceof EventSettingsError)
    return error.code;
  if (error instanceof MatchCommandError) return error.code.toLowerCase();
  console.error("Match admin action failed", error);
  return "save_failed";
}

function afterChange() {
  refreshPublicResults();
  revalidatePath("/admin", "layout");
}

// Adds ?message= or ?error= before any #anchor so the banner shows.
function withStatus(
  destination: string,
  key: "message" | "error",
  value: string,
) {
  const [path, hash] = destination.split("#");
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${value}${hash ? `#${hash}` : ""}`;
}

// signal tells open staff screens to fetch the change (after the response).
/**
 * Edits can be made from the match monitor as well as a match's own page, so
 * an action returns to wherever it was submitted from. Only in-app paths are
 * accepted, never an absolute URL.
 */
function returnPath(formData: FormData, fallback: string) {
  const raw = String(formData.get("returnTo") ?? "");
  return /^\/admin\/[\w/?=&.-]*$/.test(raw) ? raw : fallback;
}

async function run(
  destination: string,
  action: () => Promise<unknown>,
  success: string,
  signal: () => Promise<void> = () => signalTournamentChange("match"),
) {
  let target = withStatus(destination, "message", success);
  try {
    await action();
    afterChange();
    after(signal);
  } catch (error) {
    target = withStatus(destination, "error", errorCode(error));
  }
  redirect(target);
}

// ---------------------------------------------------------------------------
// Game-level: scoring rules and draw

export async function updateScoringRulesAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const gameId = id.safeParse(formData.get("tournamentGameId"));
  if (!gameId.success) redirect("/admin/games?error=game_not_found");
  const base = `/admin/games/${gameId.data}`;

  const rules = scoringRulesSchema.safeParse({
    scoringAdapter: text(formData, "scoringAdapter"),
    progressionMode: text(formData, "progressionMode"),
  });
  if (!rules.success) redirect(`${base}?error=invalid_scoring_rules#scoring`);

  // Fields for a newly picked adapter are not on the page yet; its defaults
  // apply and can be adjusted after saving.
  const adapter = getScoringAdapter(rules.data.scoringAdapter);
  const sameAdapter = text(formData, "configFor") === rules.data.scoringAdapter;
  const config = sameAdapter
    ? configFromForm(adapter, (name) => formData.get(`config.${name}`))
    : {};

  await run(
    `${base}#scoring`,
    () =>
      updateScoringRules({
        actorId: actor.id,
        tournamentGameId: gameId.data,
        ...rules.data,
        config,
      }),
    "scoring_saved",
  );
}

export async function generateBracketAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const gameId = id.safeParse(formData.get("tournamentGameId"));
  if (!gameId.success) redirect("/admin/games?error=game_not_found");
  const seeding = text(formData, "seeding") === "MANUAL" ? "MANUAL" : "RANDOM";
  const manualOrder = text(formData, "manualOrder")
    .split(/[\s,]+/)
    .map((code) => code.trim())
    .filter(Boolean);

  await run(
    `/admin/games/${gameId.data}#draw`,
    () =>
      generateBracket({
        actorId: actor.id,
        tournamentGameId: gameId.data,
        seeding,
        manualOrder,
      }),
    "bracket_generated",
  );
}

export async function resetBracketAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const gameId = id.safeParse(formData.get("tournamentGameId"));
  if (!gameId.success) redirect("/admin/games?error=game_not_found");
  if (text(formData, "confirm") !== "RESET") {
    redirect(`/admin/games/${gameId.data}?error=confirm_reset#draw`);
  }
  await run(
    `/admin/games/${gameId.data}#draw`,
    () => resetBracket({ actorId: actor.id, tournamentGameId: gameId.data }),
    "bracket_reset",
  );
}

export async function addRoundAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const gameId = id.safeParse(formData.get("tournamentGameId"));
  if (!gameId.success) redirect("/admin/games?error=game_not_found");
  await run(
    `/admin/games/${gameId.data}#draw`,
    () =>
      addRound({
        actorId: actor.id,
        tournamentGameId: gameId.data,
        name: text(formData, "name"),
      }),
    "round_added",
  );
}

export async function addManualMatchAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const gameId = id.safeParse(formData.get("tournamentGameId"));
  const roundId = id.safeParse(formData.get("roundId"));
  if (!gameId.success || !roundId.success)
    redirect("/admin/games?error=game_not_found");
  const entries = formData
    .getAll("entryId")
    .map(String)
    .filter((value) => id.safeParse(value).success);
  const scheduled = text(formData, "scheduledAt");
  const station = text(formData, "station").trim().slice(0, 80) || null;

  await run(
    `/admin/games/${gameId.data}#draw`,
    () =>
      addManualMatch({
        actorId: actor.id,
        roundId: roundId.data,
        registrationGameEntryIds: entries,
        scheduledAt: scheduled ? dhakaInputToDate(scheduled) : null,
        station,
      }),
    "match_added",
  );
}

export async function deleteManualMatchAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const gameId = id.safeParse(formData.get("tournamentGameId"));
  const matchId = id.safeParse(formData.get("matchId"));
  if (!gameId.success || !matchId.success)
    redirect("/admin/games?error=game_not_found");
  await run(
    `/admin/games/${gameId.data}#draw`,
    () => deleteManualMatch({ actorId: actor.id, matchId: matchId.data }),
    "match_deleted",
  );
}

// ---------------------------------------------------------------------------
// Match-level admin controls

function matchTarget(formData: FormData) {
  const matchId = id.safeParse(formData.get("matchId"));
  if (!matchId.success) redirect("/admin/matches?error=match_not_found");
  return matchId.data;
}

export async function reopenMatchAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const matchId = matchTarget(formData);
  await run(
    `/admin/matches/${matchId}`,
    () => reopenMatch({ actor, matchId, reason: text(formData, "reason") }),
    "match_reopened",
    () => signalMatchChange(matchId, { includeNext: true }),
  );
}

export async function postponeMatchAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const matchId = matchTarget(formData);
  await run(
    returnPath(formData, `/admin/matches/${matchId}`),
    () => postponeMatch({ actor, matchId, reason: text(formData, "reason") }),
    "match_postponed",
    () => signalMatchChange(matchId),
  );
}

export async function resumeMatchAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const matchId = matchTarget(formData);
  await run(
    returnPath(formData, `/admin/matches/${matchId}`),
    () => resumeMatch({ actor, matchId }),
    "match_resumed",
    () => signalMatchChange(matchId),
  );
}

export async function cancelMatchAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const matchId = matchTarget(formData);
  await run(
    `/admin/matches/${matchId}`,
    () => cancelMatch({ actor, matchId, reason: text(formData, "reason") }),
    "match_cancelled",
    () => signalMatchChange(matchId),
  );
}

export async function updateMatchScheduleAction(formData: FormData) {
  const actor = await requireSuperAdmin();
  const matchId = matchTarget(formData);
  const scheduled = text(formData, "scheduledAt");
  const scheduledAt = scheduled ? dhakaInputToDate(scheduled) : null;
  const back = returnPath(formData, `/admin/matches/${matchId}`);
  if (scheduled && !scheduledAt) redirect(`${back}?error=invalid_schedule`);

  await run(
    back,
    () =>
      updateMatchSchedule({
        actor,
        matchId,
        scheduledAt,
        venue: text(formData, "venue").trim().slice(0, 180) || null,
        station: text(formData, "station").trim().slice(0, 80) || null,
      }),
    "schedule_saved",
    () => signalMatchChange(matchId),
  );
}
