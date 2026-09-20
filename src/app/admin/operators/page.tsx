import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Plus, UserPlus } from "lucide-react";
import { requireSuperAdminPage } from "@/features/auth/server/staff-session";
import {
  createOperatorAction,
  setGameAccessAction,
} from "@/features/operators/server/actions";
import { getOperators } from "@/features/operators/server/operator-queries";
import adminStyles from "@/features/admin/components/admin.module.css";
import styles from "@/features/operators/components/operators.module.css";

export const metadata: Metadata = { title: "Operators" };
export const dynamic = "force-dynamic";

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireSuperAdminPage();
  const [{ tournamentId, games, operators }, { error, message }] =
    await Promise.all([getOperators(), searchParams]);
  const invitationsConfigured = Boolean(process.env.SUPABASE_SECRET_KEY);

  return (
    <div className={adminStyles.content}>
      <header className={adminStyles.pageHeader}>
        <div>
          <p>Staff access</p>
          <h1>Operators</h1>
          <span>
            Invite score operators, then tick the games each one will score.
          </span>
        </div>
      </header>

      {message ? (
        <div className={styles.success} role="status">
          {message === "game_added"
            ? "Game added. They can score every match in it."
            : "Game removed."}
        </div>
      ) : null}
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
          An invitation creates the account only. They see no matches until you
          tick a game below, which lets them score every match in that game. The
          email is sent from the official NDCAK Gmail and its delivery is
          visible under Notifications.
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
          <div>
            {operators.map((operator) => {
              const covered = new Set(operator.gameIds);
              return (
                <article key={operator.id} className={styles.operatorCard}>
                  <div className={styles.operatorTop}>
                    <span className={styles.avatar} aria-hidden="true">
                      {operator.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className={styles.person}>
                      <strong>{operator.displayName}</strong>
                      <small>{operator.email ?? "Email unavailable"}</small>
                    </span>
                    <span
                      className={styles.state}
                      data-active={operator.active}
                    >
                      {operator.active ? "Active" : "Inactive"}
                    </span>
                    <Link
                      className={styles.detailLink}
                      href={`/admin/operators/${operator.id}`}
                    >
                      Details <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>

                  {operator.coversEverything ? (
                    <p className={styles.gamesNote}>
                      Covers every game in the tournament. Change that under
                      Details.
                    </p>
                  ) : !operator.active ? (
                    <p className={styles.gamesNote}>
                      Reactivate this operator under Details to hand them a
                      game.
                    </p>
                  ) : games.length === 0 ? (
                    <p className={styles.gamesNote}>
                      Add games to the tournament first, in{" "}
                      <Link href="/admin/games">Games</Link>.
                    </p>
                  ) : (
                    <>
                      <p className={styles.gamesLabel}>Games they score</p>
                      <div className={styles.gameChips}>
                        {games.map((game) => {
                          const on = covered.has(game.id);
                          return (
                            <form key={game.id} action={setGameAccessAction}>
                              <input
                                type="hidden"
                                name="operatorId"
                                value={operator.id}
                              />
                              <input
                                type="hidden"
                                name="tournamentId"
                                value={tournamentId ?? ""}
                              />
                              <input
                                type="hidden"
                                name="tournamentGameId"
                                value={game.id}
                              />
                              <input
                                type="hidden"
                                name="enabled"
                                value={String(!on)}
                              />
                              <button
                                type="submit"
                                className={styles.gameChip}
                                aria-pressed={on}
                              >
                                {on ? (
                                  <Check size={14} aria-hidden="true" />
                                ) : (
                                  <Plus size={14} aria-hidden="true" />
                                )}
                                {game.name}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {operator.otherScopes > 0 ? (
                    <p className={styles.gamesNote}>
                      Also has {operator.otherScopes} narrower{" "}
                      {operator.otherScopes === 1
                        ? "assignment"
                        : "assignments"}{" "}
                      under Details.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
