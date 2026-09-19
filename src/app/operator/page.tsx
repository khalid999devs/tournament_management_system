import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/staff/actions";
import { LiveRefresh } from "@/components/live/live-refresh";
import { requireOperatorPage } from "@/features/auth/server/staff-session";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { IssueList } from "@/features/issues/components/issue-list";
import { IssueReportForm } from "@/features/issues/components/issue-report-form";
import { listOwnIssues } from "@/features/issues/server/issues";
import { describeStatus } from "@/features/matches/domain/commands";
import { getOperatorWorkload } from "@/features/operators/server/workload";
import { formatDhakaDateTime } from "@/lib/dates";
import styles from "@/features/operators/components/workspace.module.css";

export const metadata: Metadata = {
  title: "Operator workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function OperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const staff = await requireOperatorPage();
  const params = await searchParams;
  const [workload, tournamentId, ownIssues] = await Promise.all([
    getOperatorWorkload(staff.id, params),
    findCurrentTournamentId(),
    listOwnIssues(staff.id),
  ]);
  const pageHref = (page: number) => {
    const query = new URLSearchParams({
      page: String(page),
      status: workload.filter,
    });
    if (workload.search) query.set("q", workload.search);
    return `/operator?${query.toString()}`;
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/brand/ndcak-mark.webp"
            alt=""
            width={160}
            height={71}
            priority
          />
          NDCAK <small>OPERATOR</small>
        </Link>
        <form action={signOut}>
          <button type="submit">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </form>
      </header>

      <div className={styles.content}>
        <div className={styles.introRow}>
          <div className={styles.intro}>
            <p>Assigned tournament work</p>
            <h1>Your matches</h1>
            <span>
              Welcome, {staff.displayName}. Live matches come first. Only
              matches within your active assignments appear here.
            </span>
          </div>
          {tournamentId ? (
            <LiveRefresh tournamentId={tournamentId} kinds={["match"]} />
          ) : null}
        </div>

        <div className={styles.boundary}>
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            Scope-checked workspace · No registration payments or transaction
            references are shown.
          </span>
        </div>

        <form className={styles.filters} action="/operator" role="search">
          <label className="visually-hidden" htmlFor="match-search">
            Search matches
          </label>
          <input
            id="match-search"
            name="q"
            defaultValue={workload.search}
            placeholder="Match code, player name or registration code"
          />
          <label className="visually-hidden" htmlFor="match-status">
            Status
          </label>
          <select
            id="match-status"
            name="status"
            defaultValue={workload.filter}
          >
            <option value="open">To play</option>
            <option value="done">Finished</option>
            <option value="all">All</option>
          </select>
          <button type="submit">Show</button>
        </form>

        {workload.rows.length === 0 ? (
          <div className={styles.empty}>
            <h2>
              {workload.search || workload.filter !== "open"
                ? "No matching matches"
                : "No matches to play"}
            </h2>
            <p>
              Your administrator can assign a tournament, game, round, match, or
              participant entry. New matches appear here when the draw is made.
            </p>
          </div>
        ) : (
          <div className={styles.tableShell}>
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Players</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>
                    <span className="visually-hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {workload.rows.map((match) => (
                  <tr key={match.id}>
                    <td>
                      <strong>{match.code}</strong>
                      <small>
                        {match.gameName} · {match.roundName}
                      </small>
                    </td>
                    <td data-label="Players">
                      {match.entrants.length
                        ? match.entrants.join(" vs ")
                        : "Waiting for earlier results"}
                    </td>
                    <td data-label="Schedule">
                      {match.scheduledAt
                        ? formatDhakaDateTime(match.scheduledAt)
                        : "Not scheduled"}
                      {match.station || match.venue ? (
                        <small>
                          {[match.station, match.venue]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Status">
                      {describeStatus(match.status)}
                      {match.displayScore ? (
                        <small>{match.displayScore}</small>
                      ) : null}
                    </td>
                    <td>
                      <Link
                        className={styles.openLink}
                        href={`/operator/matches/${match.id}`}
                      >
                        Open score entry
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className={styles.reportCard}>
          <summary>Report a problem that is not about one match</summary>
          <p>
            For example a missing table, a venue issue or a question for the
            admins. To report a problem with a match, open its score entry.
          </p>
          <IssueReportForm matchId={null} />
          {ownIssues.length ? (
            <>
              <h2>Your recent reports</h2>
              <IssueList issues={ownIssues} showMatch />
            </>
          ) : null}
        </details>

        {workload.pageCount > 1 ? (
          <nav className={styles.pagination} aria-label="Match pages">
            <span>
              Page {workload.page} of {workload.pageCount}
            </span>
            <div>
              {workload.page > 1 ? (
                <Link href={pageHref(workload.page - 1)}>Previous</Link>
              ) : null}
              {workload.page < workload.pageCount ? (
                <Link href={pageHref(workload.page + 1)}>Next</Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
