import { z } from "zod";
import { getCurrentStaff } from "@/features/auth/server/staff-session";
import { commandEnvelopeSchema } from "@/features/matches/domain/commands";
import {
  executeScoreCommand,
  MatchCommandError,
  type MatchErrorCode,
} from "@/features/matches/server/match-commands";
import {
  getMatchState,
  getMatchVersion,
} from "@/features/matches/server/match-queries";
import { refreshPublicResults } from "@/features/matches/server/public-results";

export const dynamic = "force-dynamic";

const matchId = z.uuid();

const statusFor: Record<MatchErrorCode, number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED_SCOPE: 403,
  STALE_MATCH_VERSION: 409,
  DOWNSTREAM_RESULT_DEPENDENCY: 409,
  DUPLICATE_EVENT: 409,
  INVALID_SCORE: 422,
  MATCH_CLOSED: 422,
  NOT_READY: 422,
  EVENT_NOT_FOUND: 422,
  REASON_REQUIRED: 422,
};

// Lock or statement timeouts and lost connections: nothing was committed, so
// the client may resend the same event id.
const retryablePgCodes = new Set([
  "55P03",
  "57014",
  "40P01",
  "40001",
  "53300",
  "08006",
  "08001",
]);

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function staffActor() {
  const staff = await getCurrentStaff();
  return staff ? { id: staff.id, role: staff.role } : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!matchId.safeParse(id).success)
    return json({ ok: false, code: "NOT_FOUND" }, 404);

  const actor = await staffActor();
  if (!actor)
    return json(
      { ok: false, code: "SIGNED_OUT", message: "Sign in again." },
      401,
    );

  const since = Number(new URL(request.url).searchParams.get("since"));
  if (Number.isSafeInteger(since) && since > 0) {
    const version = await getMatchVersion(id, actor);
    if (version === null) return json({ ok: false, code: "NOT_FOUND" }, 404);
    if (version === since) return json({ ok: true, unchanged: true, version });
  }

  const state = await getMatchState(id, actor);
  if (!state) return json({ ok: false, code: "NOT_FOUND" }, 404);
  return json({ ok: true, state });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!matchId.safeParse(id).success)
    return json({ ok: false, code: "NOT_FOUND" }, 404);

  // Only same-origin pages may submit scores.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, code: "FORBIDDEN" }, 403);
  }

  const actor = await staffActor();
  if (!actor)
    return json(
      { ok: false, code: "SIGNED_OUT", message: "Sign in again." },
      401,
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, code: "INVALID_SCORE", message: "Unreadable request." },
      400,
    );
  }
  const envelope = commandEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    return json(
      {
        ok: false,
        code: "INVALID_SCORE",
        message: "That action is not valid.",
      },
      400,
    );
  }

  const { clientEventId, deviceTime, command } = envelope.data;
  const device = deviceTime ? new Date(deviceTime) : null;
  // Keep implausible device clocks out of the timing record.
  const plausible =
    device && Math.abs(device.getTime() - Date.now()) < 24 * 60 * 60 * 1000
      ? device
      : null;

  try {
    const outcome = await executeScoreCommand({
      actor,
      matchId: id,
      clientEventId,
      deviceTime: plausible,
      command,
    });
    // Public pages show confirmed results only, so they refresh on these.
    if (
      !outcome.duplicate &&
      (command.type === "FINALIZE" || command.type === "WALKOVER")
    ) {
      refreshPublicResults();
    }
    const state = await getMatchState(id, actor);
    return json({
      ok: true,
      duplicate: outcome.duplicate,
      version: outcome.version,
      state,
    });
  } catch (error) {
    if (error instanceof MatchCommandError) {
      // Send the current state back so the screen shows what changed.
      const state =
        error.code === "NOT_FOUND" || error.code === "UNAUTHORIZED_SCOPE"
          ? null
          : await getMatchState(id, actor).catch(() => null);
      return json(
        {
          ok: false,
          code: error.code,
          message: error.message,
          retryable: false,
          state,
        },
        statusFor[error.code],
      );
    }

    const pgCode =
      (error as { cause?: { code?: string } })?.cause?.code ??
      (error as { code?: string })?.code;
    console.error("Score command failed", {
      matchId: id,
      clientEventId,
      pgCode,
      error,
    });
    return json(
      {
        ok: false,
        code: "TEMPORARY_FAILURE",
        message:
          "The server is busy. Your action is kept and will be sent again.",
        retryable: true,
      },
      pgCode && retryablePgCodes.has(pgCode) ? 503 : 500,
    );
  }
}
