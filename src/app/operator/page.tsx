import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/staff/actions";
import { requireOperatorPage } from "@/features/auth/server/staff-session";
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
  searchParams: Promise<{ page?: string }>;
}) {
  const staff = await requireOperatorPage();
  const { page } = await searchParams;
  const workload = await getOperatorWorkload(staff.id, page);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span>∞</span> NDCAK <small>OPERATOR</small>
        </Link>
        <form action={signOut}>
          <button type="submit">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </form>
      </header>

      <div className={styles.content}>
        <div className={styles.intro}>
          <p>Assigned tournament work</p>
          <h1>Your matches</h1>
          <span>
            Welcome, {staff.displayName}. Only matches within your active
            assignments appear here.
          </span>
        </div>

        <div className={styles.boundary}>
          <ShieldCheck size={20} aria-hidden="true" />
          <span>
            Scope-checked workspace · No registration payments or transaction
            references are shown.
          </span>
        </div>

        {workload.rows.length === 0 ? (
          <div className={styles.empty}>
            <h2>No matches assigned yet</h2>
            <p>
              Your administrator can assign a tournament, game, round, match, or
              participant entry. New matches will appear here when scheduled.
            </p>
          </div>
        ) : (
          <div className={styles.tableShell}>
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Game and round</th>
                  <th>Schedule</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {workload.rows.map((match) => (
                  <tr key={match.id}>
                    <td>
                      <strong>{match.code}</strong>
                      <small>{match.tournamentName}</small>
                    </td>
                    <td>
                      <strong>{match.gameName}</strong>
                      <small>{match.roundName}</small>
                    </td>
                    <td>
                      {match.scheduledAt
                        ? formatDhakaDateTime(match.scheduledAt)
                        : "Not scheduled"}
                    </td>
                    <td>
                      {[match.venue, match.station]
                        .filter(Boolean)
                        .join(" · ") || "To be announced"}
                    </td>
                    <td>{match.status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {workload.pageCount > 1 ? (
          <nav className={styles.pagination} aria-label="Match pages">
            <span>
              Page {workload.page} of {workload.pageCount}
            </span>
            <div>
              {workload.page > 1 ? (
                <Link href={`/operator?page=${workload.page - 1}`}>
                  Previous
                </Link>
              ) : null}
              {workload.page < workload.pageCount ? (
                <Link href={`/operator?page=${workload.page + 1}`}>Next</Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
