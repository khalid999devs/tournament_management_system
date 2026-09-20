import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireSuperAdminPage } from "@/features/auth/server/staff-session";
import { describeCapabilities } from "@/features/operators/domain/access-levels";
import {
  revokeAssignmentAction,
  setOperatorActiveAction,
} from "@/features/operators/server/actions";
import { AccessGuide } from "@/features/operators/components/access-guide";
import { AssignmentForm } from "@/features/operators/components/assignment-form";
import { getOperatorDetail } from "@/features/operators/server/operator-queries";
import adminStyles from "@/features/admin/components/admin.module.css";
import styles from "@/features/operators/components/operators.module.css";

export const metadata: Metadata = { title: "Operator access" };
export const dynamic = "force-dynamic";

const scopeLabels: Record<string, string> = {
  ALL_TOURNAMENT: "Whole tournament",
  GAME: "One game",
  ROUND: "One round",
  MATCH: "One match",
  PARTICIPANT_ENTRY: "One player",
};

const messages: Record<string, string> = {
  created: "Operator added. The invitation email is on its way.",
  reactivated: "Operator reactivated.",
  deactivated: "Operator deactivated.",
  assignment_granted: "Access added.",
  assignment_updated:
    "Access updated. They already covered that, so it was replaced rather than added again.",
  assignments_granted: "Access added.",
  assignment_revoked: "Access removed.",
};

export default async function OperatorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [data, status] = await Promise.all([
    getOperatorDetail(id),
    searchParams,
  ]);
  if (!data) notFound();

  const { profile, assignments, invitation, options } = data;
  // One tournament is the normal case, so its name only clutters the labels.
  const prefix = options.tournaments.length > 1;
  const labels = new Map<string, string>([
    ...options.tournaments.map((item) => [item.id, item.label] as const),
    ...options.games.map(
      (item) =>
        [
          item.id,
          prefix ? `${item.tournamentName} · ${item.label}` : item.label,
        ] as const,
    ),
    ...options.rounds.map(
      (item) => [item.id, `${item.gameName} · ${item.label}`] as const,
    ),
    ...options.matches.map(
      (item) =>
        [
          item.id,
          `${item.gameName} · ${item.roundName} · ${item.label}`,
        ] as const,
    ),
    ...options.entries.map(
      (item) =>
        [
          item.id,
          `${item.label} · ${item.gameName} · ${item.registrationCode}`,
        ] as const,
    ),
  ]);

  // Whole-tournament access already covers every narrower grant beside it.
  const coversEverything = new Set(
    assignments
      .filter((assignment) => assignment.scopeType === "ALL_TOURNAMENT")
      .map((assignment) => assignment.tournamentId),
  );

  return (
    <div className={adminStyles.content}>
      <Link className={styles.back} href="/admin/operators">
        <ArrowLeft size={16} aria-hidden="true" /> All operators
      </Link>
      <header className={adminStyles.pageHeader}>
        <div>
          <p>Operator access</p>
          <h1>{profile.displayName}</h1>
          <span>{profile.email ?? "Email unavailable"}</span>
        </div>
      </header>

      {status.message ? (
        <div className={styles.success} role="status">
          {messages[status.message] ?? status.message.replaceAll("_", " ")}
        </div>
      ) : null}
      {status.error ? (
        <div className={styles.alert} role="alert">
          {status.error === "scope_target_invalid"
            ? "That choice does not belong to the tournament. Reload the page and try again."
            : "The change could not be saved. Check the selection and try again."}
        </div>
      ) : null}

      <section className={styles.panel} aria-labelledby="account-title">
        <div className={styles.panelHeading}>
          <div>
            <p>Account lifecycle</p>
            <h2 id="account-title">Staff account</h2>
          </div>
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <div className={styles.accountLine}>
          <div>
            <strong>
              {profile.active ? "Active operator" : "Inactive operator"}
            </strong>
            <span>
              {profile.active
                ? "Can sign in and see whatever is listed below."
                : "Cannot sign in. Reactivating does not bring their access back."}
            </span>
            {invitation ? (
              <small>Invitation email: {invitation.status.toLowerCase()}</small>
            ) : null}
          </div>
          <form action={setOperatorActiveAction}>
            <input type="hidden" name="operatorId" value={profile.id} />
            <input
              type="hidden"
              name="active"
              value={String(!profile.active)}
            />
            <button type="submit" className={styles.secondaryButton}>
              {profile.active ? "Deactivate" : "Reactivate"}
            </button>
          </form>
        </div>
        {invitation?.status === "FAILED" ? (
          <p className={styles.helper}>
            Delivery failed. Retry it from{" "}
            <Link href="/admin/notifications">Notifications</Link>.
          </p>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="assignments-title">
        <div className={styles.panelHeading}>
          <div>
            <p>What this operator can reach</p>
            <h2 id="assignments-title">Assignments</h2>
          </div>
          <span className={styles.count}>{assignments.length} active</span>
        </div>
        <p className={styles.helper}>
          Access adds up, and they never see payment details.
        </p>
        {assignments.length === 0 ? (
          <div className={styles.empty}>
            <h3>No access yet</h3>
            <p>This operator cannot see any matches.</p>
          </div>
        ) : (
          <div className={styles.assignmentList}>
            {assignments.map((assignment) => {
              const targetId =
                assignment.tournamentGameId ??
                assignment.roundId ??
                assignment.matchId ??
                assignment.registrationGameEntryId ??
                assignment.tournamentId;
              const redundant =
                assignment.scopeType !== "ALL_TOURNAMENT" &&
                coversEverything.has(assignment.tournamentId);

              return (
                <div key={assignment.id} className={styles.assignment}>
                  <div>
                    <span className={styles.scopeType}>
                      {scopeLabels[assignment.scopeType] ??
                        assignment.scopeType.replaceAll("_", " ")}
                    </span>
                    <strong>{labels.get(targetId) ?? targetId}</strong>
                    <small>
                      {describeCapabilities(assignment.capabilities)}
                    </small>
                    {redundant ? (
                      <small className={styles.redundant}>
                        Already covered by their whole-tournament access.
                      </small>
                    ) : null}
                  </div>
                  <form action={revokeAssignmentAction}>
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={assignment.id}
                    />
                    <input type="hidden" name="operatorId" value={profile.id} />
                    <button type="submit" className={styles.secondaryButton}>
                      Remove
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {profile.active ? (
        <section className={styles.panel} aria-labelledby="grant-title">
          <div className={styles.panelHeading}>
            <div>
              <p>Give access</p>
              <h2 id="grant-title">Add an assignment</h2>
            </div>
            <AccessGuide />
          </div>
          <AssignmentForm
            operatorId={profile.id}
            options={{
              tournaments: options.tournaments.map((item) => ({
                value: `ALL_TOURNAMENT|${item.id}|`,
                label: item.label,
              })),
              games: options.games.map((item) => ({
                value: `GAME|${item.tournamentId}|${item.id}`,
                label: labels.get(item.id) ?? item.label,
              })),
              rounds: options.rounds.map((item) => ({
                value: `ROUND|${item.tournamentId}|${item.id}`,
                label: labels.get(item.id) ?? item.label,
              })),
              matches: options.matches.map((item) => ({
                value: `MATCH|${item.tournamentId}|${item.id}`,
                label: labels.get(item.id) ?? item.label,
              })),
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
