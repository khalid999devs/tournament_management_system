"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  getCurrentStaff,
  requireSuperAdmin,
} from "@/features/auth/server/staff-session";
import {
  signalMatchChange,
  signalTournamentChange,
} from "@/lib/realtime/signal";
import { issueReportSchema, issueResolveSchema } from "../domain/issues";
import { IssueError, reportIssue, resolveIssue } from "./issues";

export type ReportIssueState = {
  status: "idle" | "success" | "error";
  message?: string;
  // The request id that succeeded, so the form starts a new report next.
  doneId?: string;
};

const errorText: Record<string, string> = {
  NOT_FOUND: "That match no longer exists.",
  UNAUTHORIZED: "Your assignment does not include reporting problems here.",
  NO_TOURNAMENT: "There is no running tournament to report on.",
};

export async function reportIssueAction(
  _previous: ReportIssueState,
  formData: FormData,
): Promise<ReportIssueState> {
  const staff = await getCurrentStaff();
  if (!staff) {
    return { status: "error", message: "Your session ended. Sign in again." };
  }

  const parsed = issueReportSchema.safeParse({
    matchId: formData.get("matchId") || null,
    category: formData.get("category") ?? "",
    message: formData.get("message") ?? "",
    clientRequestId: formData.get("clientRequestId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the report.",
    };
  }

  try {
    const result = await reportIssue({
      actor: { id: staff.id, role: staff.role },
      report: parsed.data,
    });
    const matchId = parsed.data.matchId;
    revalidatePath("/admin", "layout");
    after(() =>
      matchId
        ? signalMatchChange(matchId, { kind: "issue" })
        : signalTournamentChange("issue", result.tournamentId),
    );
    return {
      status: "success",
      message: "Report sent. Admins see it straight away.",
      doneId: parsed.data.clientRequestId,
    };
  } catch (error) {
    if (error instanceof IssueError) {
      return { status: "error", message: errorText[error.code] };
    }
    console.error("Issue report failed", error);
    return {
      status: "error",
      message: "The report could not be sent. Try again.",
    };
  }
}

// Only admin pages post here, so the return path must stay in /admin.
function safeReturn(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "";
  return (path === "/admin" || path.startsWith("/admin/")) &&
    !path.includes("//")
    ? path
    : "/admin/issues";
}

function withStatus(path: string, key: "message" | "error", value: string) {
  const [base, hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}${key}=${value}${hash ? `#${hash}` : ""}`;
}

export async function resolveIssueAction(formData: FormData) {
  const staff = await requireSuperAdmin();
  const returnTo = safeReturn(formData.get("returnTo"));
  const parsed = issueResolveSchema.safeParse({
    issueId: formData.get("issueId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect(withStatus(returnTo, "error", "issue_invalid"));

  let target = withStatus(returnTo, "message", "issue_resolved");
  try {
    const result = await resolveIssue({
      actorId: staff.id,
      issueId: parsed.data.issueId,
      note: parsed.data.note,
    });
    if (result.changed) {
      after(() =>
        result.matchId
          ? signalMatchChange(result.matchId, { kind: "issue" })
          : signalTournamentChange("issue", result.tournamentId),
      );
    }
    // The open count in the admin menu lives in the layout.
    revalidatePath("/admin", "layout");
  } catch (error) {
    if (!(error instanceof IssueError)) console.error("Resolve failed", error);
    target = withStatus(returnTo, "error", "issue_not_found");
  }
  redirect(target);
}
