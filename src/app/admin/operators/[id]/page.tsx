import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireSuperAdminPage } from "@/features/auth/server/staff-session";
import {
  grantAssignmentAction,
  revokeAssignmentAction,
  setOperatorActiveAction,
} from "@/features/operators/server/actions";
import { getOperatorDetail } from "@/features/operators/server/operator-queries";
import adminStyles from "@/features/admin/components/admin.module.css";
import styles from "@/features/operators/components/operators.module.css";

export const metadata: Metadata = { title: "Operator access" };
export const dynamic = "force-dynamic";

const capabilityLabels: Record<string, string> = {
  VIEW: "View",
  SCORE_UPDATE: "Update scores",
  FINALIZE_MATCH: "Finalize matches",
  ISSUE_REPORT: "Report problems",
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
  const labels = new Map<string, string>([
    ...options.tournaments.map((item) => [item.id, item.label] as const),
    ...options.games.map(
      (item) => [item.id, `${item.tournamentName} · ${item.label}`] as const,
    ),
    ...options.rounds.map(
      (item) =>
        [
          item.id,
          `${item.tournamentName} · ${item.gameName} · ${item.label}`,
        ] as const,
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
          {status.message.replaceAll("_", " ")}.
        </div>
      ) : null}
      {status.error ? (
        <div className={styles.alert} role="alert">
          {status.error === "scope_target_invalid"
            ? "The selected scope does not belong to that tournament."
            : "The requested change could not be saved. Check the selection and try again."}
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
                ? "Can sign in, but only active assignments grant access."
                : "Cannot open the operator workspace. Previous assignments stay revoked."}
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
            <p>Least-privilege access</p>
            <h2 id="assignments-title">Assignments</h2>
          </div>
          <span className={styles.count}>
            {assignments.filter((assignment) => assignment.active).length}{" "}
            active
          </span>
        </div>
        <p className={styles.helper}>
          Scopes are additive. Deactivation or revocation takes effect on the
          next server request. Payment details are never included in operator
          views.
        </p>
        {assignments.length === 0 ? (
          <div className={styles.empty}>
            <h3>No assignments yet</h3>
            <p>This operator cannot view any matches.</p>
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

              return (
                <div key={assignment.id} className={styles.assignment}>
                  <div>
                    <span className={styles.scopeType}>
                      {assignment.scopeType.replaceAll("_", " ")}
                    </span>
                    <strong>{labels.get(targetId) ?? targetId}</strong>
                    <small>
                      {assignment.capabilities
                        .map((capability) => capabilityLabels[capability])
                        .join(" · ")}
                    </small>
                  </div>
                  {assignment.active ? (
                    <form action={revokeAssignmentAction}>
                      <input
                        type="hidden"
                        name="assignmentId"
                        value={assignment.id}
                      />
                      <input
                        type="hidden"
                        name="operatorId"
                        value={profile.id}
                      />
                      <button type="submit" className={styles.secondaryButton}>
                        Revoke
                      </button>
                    </form>
                  ) : (
                    <span className={styles.revoked}>Revoked</span>
                  )}
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
              <p>Grant access</p>
              <h2 id="grant-title">Add an assignment</h2>
            </div>
          </div>
          <div className={styles.grantGrid}>
            <GrantForm
              operatorId={profile.id}
              title="Whole tournament"
              scopeType="ALL_TOURNAMENT"
              options={options.tournaments.map((item) => ({
                value: `${item.id}|`,
                label: item.label,
              }))}
            />
            <GrantForm
              operatorId={profile.id}
              title="Game"
              scopeType="GAME"
              options={options.games.map((item) => ({
                value: `${item.tournamentId}|${item.id}`,
                label: `${item.tournamentName} · ${item.label}`,
              }))}
            />
            <GrantForm
              operatorId={profile.id}
              title="Round"
              scopeType="ROUND"
              options={options.rounds.map((item) => ({
                value: `${item.tournamentId}|${item.id}`,
                label: `${item.tournamentName} · ${item.gameName} · ${item.label}`,
              }))}
            />
            <GrantForm
              operatorId={profile.id}
              title="Match"
              scopeType="MATCH"
              options={options.matches.map((item) => ({
                value: `${item.tournamentId}|${item.id}`,
                label: `${item.tournamentName} · ${item.gameName} · ${item.label}`,
              }))}
            />
            <GrantForm
              operatorId={profile.id}
              title="Participant entry"
              scopeType="PARTICIPANT_ENTRY"
              options={options.entries.map((item) => ({
                value: `${item.tournamentId}|${item.id}`,
                label: `${item.label} · ${item.gameName} · ${item.registrationCode}`,
              }))}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GrantForm({
  operatorId,
  title,
  scopeType,
  options,
}: {
  operatorId: string;
  title: string;
  scopeType:
    "ALL_TOURNAMENT" | "GAME" | "ROUND" | "MATCH" | "PARTICIPANT_ENTRY";
  options: { value: string; label: string }[];
}) {
  return (
    <form className={styles.grantForm} action={grantAssignmentAction}>
      <input type="hidden" name="operatorId" value={operatorId} />
      <input type="hidden" name="scopeType" value={scopeType} />
      <h3>{title}</h3>
      <label>
        Target
        <select name="scopeTarget" required disabled={options.length === 0}>
          <option value="">Select a target</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Capabilities</legend>
        <label>
          <input
            type="checkbox"
            name="capabilities"
            value="VIEW"
            defaultChecked
          />
          View
        </label>
        <label>
          <input type="checkbox" name="capabilities" value="SCORE_UPDATE" />
          Update scores
        </label>
        <label>
          <input type="checkbox" name="capabilities" value="FINALIZE_MATCH" />
          Finalize matches
        </label>
        <label>
          <input type="checkbox" name="capabilities" value="ISSUE_REPORT" />
          Report issues
        </label>
      </fieldset>
      <button type="submit" disabled={options.length === 0}>
        Grant access
      </button>
    </form>
  );
}
