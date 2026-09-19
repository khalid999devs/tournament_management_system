import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
import { requireSuperAdminPage } from "@/features/auth/server/staff-session";
import { createOperatorAction } from "@/features/operators/server/actions";
import { getOperators } from "@/features/operators/server/operator-queries";
import adminStyles from "@/features/admin/components/admin.module.css";
import styles from "@/features/operators/components/operators.module.css";

export const metadata: Metadata = { title: "Operators" };
export const dynamic = "force-dynamic";

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSuperAdminPage();
  const [operators, { error }] = await Promise.all([
    getOperators(),
    searchParams,
  ]);
  const invitationsConfigured = Boolean(process.env.SUPABASE_SECRET_KEY);

  return (
    <div className={adminStyles.content}>
      <header className={adminStyles.pageHeader}>
        <div>
          <p>Staff access</p>
          <h1>Operators</h1>
          <span>
            Invite score operators, then grant only the tournament work they
            need.
          </span>
        </div>
      </header>

      {error ? (
        <div className={styles.alert} role="alert">
          {error === "already_exists"
            ? "That email already belongs to a staff profile."
            : error === "auth_invite_failed"
              ? "Supabase could not create the invitation. Check the Auth configuration."
              : "The operator could not be created. Check the details and server configuration."}
        </div>
      ) : null}

      <section className={styles.panel} aria-labelledby="invite-title">
        <div className={styles.panelHeading}>
          <div>
            <p>New team member</p>
            <h2 id="invite-title">Invite an operator</h2>
          </div>
          <UserPlus size={24} aria-hidden="true" />
        </div>
        <p className={styles.helper}>
          An invitation grants a staff account only. Access to matches remains
          off until you add an assignment. The invitation email is sent through
          Resend and its delivery is visible under Notifications.
        </p>
        {!invitationsConfigured ? (
          <div className={styles.notice} role="status">
            Add the server-only SUPABASE_SECRET_KEY to enable invitations.
          </div>
        ) : null}
        <form className={styles.inviteForm} action={createOperatorAction}>
          <label>
            Full name
            <input
              name="displayName"
              autoComplete="name"
              minLength={2}
              maxLength={160}
              placeholder="Operator name"
              required
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="operator@example.com"
              required
            />
          </label>
          <button type="submit" disabled={!invitationsConfigured}>
            Send invitation <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="team-title">
        <div className={styles.panelHeading}>
          <div>
            <p>Team directory</p>
            <h2 id="team-title">Current operators</h2>
          </div>
          <span className={styles.count}>{operators.length}</span>
        </div>
        {operators.length === 0 ? (
          <div className={styles.empty}>
            <h3>No operators yet</h3>
            <p>
              Invite the first operator when the staff email setup is ready.
            </p>
          </div>
        ) : (
          <div className={styles.directory}>
            {operators.map((operator) => (
              <Link key={operator.id} href={`/admin/operators/${operator.id}`}>
                <span className={styles.avatar} aria-hidden="true">
                  {operator.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.person}>
                  <strong>{operator.displayName}</strong>
                  <small>{operator.email ?? "Email unavailable"}</small>
                </span>
                <span className={styles.state} data-active={operator.active}>
                  {operator.active ? "Active" : "Inactive"}
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
