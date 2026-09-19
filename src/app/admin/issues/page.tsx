import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LiveRefresh } from "@/components/live/live-refresh";
import styles from "@/features/admin/components/admin.module.css";
import { StatusMessages } from "@/features/event/components/status-messages";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { IssueList } from "@/features/issues/components/issue-list";
import { getAdminIssuePage } from "@/features/issues/server/issues";

export const metadata: Metadata = { title: "Problem reports" };
export const dynamic = "force-dynamic";

const tabs = [
  { status: "OPEN", label: "Open" },
  { status: "RESOLVED", label: "Resolved" },
  { status: "ALL", label: "All" },
] as const;

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    page?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const [data, tournamentId] = await Promise.all([
    getAdminIssuePage(params),
    findCurrentTournamentId(),
  ]);
  const here = (page: number) =>
    `/admin/issues?status=${data.status}&page=${page}`;

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <div>
          <p>Event day</p>
          <h1>Problem reports</h1>
          <span>
            {data.open} open. Operators flag problems from the score screen;
            resolving one records who handled it and what was done.
          </span>
        </div>
        {tournamentId ? (
          <LiveRefresh tournamentId={tournamentId} kinds={["issue"]} />
        ) : null}
      </header>

      <StatusMessages message={params.message} error={params.error} />

      <nav className={styles.tabs} aria-label="Report status">
        {tabs.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/issues?status=${tab.status}`}
            aria-current={data.status === tab.status ? "page" : undefined}
          >
            {tab.label}
            {tab.status === "OPEN" && data.open ? ` (${data.open})` : ""}
          </Link>
        ))}
      </nav>

      {data.rows.length ? (
        <IssueList
          issues={data.rows}
          showMatch
          matchHref={(id) => `/admin/matches/${id}`}
          resolveReturnTo={here(data.page)}
        />
      ) : (
        <div
          className={styles.tableShell}
          role="region"
          aria-label="Problem reports"
          tabIndex={0}
        >
          <div className={styles.emptyState}>
            <h2>
              {data.status === "OPEN" ? "No open reports" : "No reports here"}
            </h2>
            <p>
              Operators can report a no-show, a disputed score or a broken table
              from any match. Reports show here straight away.
            </p>
          </div>
        </div>
      )}

      {data.pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Report pages">
          <span>
            Page {data.page} of {data.pageCount}
          </span>
          <div>
            {data.page > 1 ? (
              <Link href={here(data.page - 1)}>
                <ChevronLeft size={16} aria-hidden="true" /> Previous
              </Link>
            ) : null}
            {data.page < data.pageCount ? (
              <Link href={here(data.page + 1)}>
                Next <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
