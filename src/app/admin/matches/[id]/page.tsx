import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import adminStyles from "@/features/admin/components/admin.module.css";
import { requireSuperAdminPage } from "@/features/auth/server/staff-session";
import styles from "@/features/event/components/settings.module.css";
import { StatusMessages } from "@/features/event/components/status-messages";
import { dateToDhakaInput } from "@/features/event/domain/event-settings";
import { ScoreConsole } from "@/features/matches/components/score-console";
import {
  cancelMatchAction,
  postponeMatchAction,
  reopenMatchAction,
  resumeMatchAction,
  updateMatchScheduleAction,
} from "@/features/matches/server/actions";
import { getMatchState } from "@/features/matches/server/match-queries";
import { MatchGuide } from "@/features/matches/components/match-guide";

export const metadata: Metadata = { title: "Match" };
export const dynamic = "force-dynamic";

export default async function AdminMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const staff = await requireSuperAdminPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [state, status] = await Promise.all([
    getMatchState(id, { id: staff.id, role: staff.role }),
    searchParams,
  ]);
  if (!state) notFound();

  const finished = state.status === "COMPLETED" || state.status === "WALKOVER";
  const open = state.status === "SCHEDULED" || state.status === "IN_PROGRESS";

  return (
    <div className={adminStyles.content}>
      <Link
        className={adminStyles.backLink}
        href={`/admin/games/${state.tournamentGameId}#draw`}
      >
        <ArrowLeft size={16} aria-hidden="true" /> {state.gameName} draw
      </Link>

      <StatusMessages {...status} />

      <div className={styles.matchLayout}>
        <ScoreConsole initial={state} actorId={staff.id} />

        <aside className={styles.matchSide} aria-label="Admin controls">
          <div className={styles.matchGuide}>
            <MatchGuide />
          </div>
          {finished ? (
            <section className={styles.panel} aria-labelledby="reopen-title">
              <div className={styles.panelHeading}>
                <div>
                  <p>Correction</p>
                  <h2 id="reopen-title">Reopen result</h2>
                  <span>
                    Puts the match back in progress so the score can be
                    corrected and confirmed again.
                    {state.nextMatch
                      ? ` The winner is withdrawn from ${state.nextMatch.code}, which is only possible while that match has not started.`
                      : ""}
                  </span>
                </div>
              </div>
              <form action={reopenMatchAction} className={styles.stack}>
                <input type="hidden" name="matchId" value={state.id} />
                <label className={styles.field}>
                  <span>Reason (kept in the audit log)</span>
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={500}
                    placeholder="e.g. Scores for the two players were swapped"
                  />
                </label>
                <button className={styles.danger} type="submit">
                  Reopen for correction
                </button>
              </form>
            </section>
          ) : null}

          {open ? (
            <section className={styles.panel} aria-labelledby="postpone-title">
              <div className={styles.panelHeading}>
                <div>
                  <p>Delay</p>
                  <h2 id="postpone-title">Postpone</h2>
                  <span>
                    Stops scoring and keeps the score and players. Resume it
                    later.
                  </span>
                </div>
              </div>
              <form action={postponeMatchAction} className={styles.stack}>
                <input type="hidden" name="matchId" value={state.id} />
                <label className={styles.field}>
                  <span>Reason</span>
                  <input
                    name="reason"
                    required
                    minLength={5}
                    maxLength={500}
                    placeholder="e.g. Table unavailable"
                  />
                </label>
                <button className={styles.secondary} type="submit">
                  Postpone match
                </button>
              </form>
            </section>
          ) : null}

          {state.status === "POSTPONED" ? (
            <section className={styles.panel}>
              <form action={resumeMatchAction} className={styles.stack}>
                <input type="hidden" name="matchId" value={state.id} />
                <button className={styles.primary} type="submit">
                  Resume match
                </button>
              </form>
            </section>
          ) : null}

          <section className={styles.panel} aria-labelledby="schedule-title">
            <div className={styles.panelHeading}>
              <div>
                <p>Logistics</p>
                <h2 id="schedule-title">Time and place</h2>
                <span>Changing these never touches the score.</span>
              </div>
            </div>
            <form action={updateMatchScheduleAction} className={styles.stack}>
              <input type="hidden" name="matchId" value={state.id} />
              <label className={styles.field}>
                <span>Start time (Dhaka)</span>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  defaultValue={dateToDhakaInput(state.scheduledAt)}
                />
              </label>
              <label className={styles.field}>
                <span>Table or station</span>
                <input
                  name="station"
                  maxLength={80}
                  defaultValue={state.station ?? ""}
                  placeholder="e.g. Table 3"
                />
              </label>
              <label className={styles.field}>
                <span>Venue</span>
                <input
                  name="venue"
                  maxLength={180}
                  defaultValue={state.venue ?? ""}
                />
              </label>
              <button className={styles.secondary} type="submit">
                Save time and place
              </button>
            </form>
          </section>

          {state.progressionMode === "MANUAL" &&
          (open || state.status === "POSTPONED") ? (
            <section className={styles.panel} aria-labelledby="cancel-title">
              <div className={styles.panelHeading}>
                <div>
                  <p>Remove</p>
                  <h2 id="cancel-title">Cancel match</h2>
                  <span>
                    Only for manually progressed games. The history is kept.
                  </span>
                </div>
              </div>
              <form action={cancelMatchAction} className={styles.stack}>
                <input type="hidden" name="matchId" value={state.id} />
                <label className={styles.field}>
                  <span>Reason</span>
                  <input name="reason" required minLength={5} maxLength={500} />
                </label>
                <button className={styles.danger} type="submit">
                  Cancel match
                </button>
              </form>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
