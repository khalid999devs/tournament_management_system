import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  describeStatus,
  type MatchStatus,
} from "@/features/matches/domain/commands";
import { getAdminMatchPage } from "@/features/matches/server/admin-match-queries";
import { formatDhakaDateTime } from "@/lib/dates";
import styles from "@/features/admin/components/admin.module.css";

export const metadata: Metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

const statusOptions: MatchStatus[] = [
  "IN_PROGRESS",
  "SCHEDULED",
  "POSTPONED",
  "COMPLETED",
  "WALKOVER",
  "CANCELLED",
];

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    game?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const data = await getAdminMatchPage(await searchParams);

  if (!data) {
    return (
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <p>Match operations</p>
            <h1>Matches</h1>
            <span>Create a tournament and make a draw first.</span>
          </div>
        </header>
      </div>
    );
  }

  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (data.filters.game) query.set("game", data.filters.game);
    if (data.filters.status) query.set("status", data.filters.status);
    if (data.filters.q) query.set("q", data.filters.q);
    query.set("page", String(page));
    return `/admin/matches?${query.toString()}`;
  };

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <div>
          <p>Match operations</p>
          <h1>Matches</h1>
          <span>
            {data.counts.live} live · {data.counts.scheduled} scheduled ·{" "}
            {data.counts.finished} finished
            {data.counts.held
              ? ` · ${data.counts.held} postponed or cancelled`
              : ""}
            . Draws are made on each game&apos;s page.
          </span>
        </div>
      </header>

      <form className={styles.filters} method="get">
        <label className={styles.searchField}>
          <span>Search</span>
          <div>
            <Search size={16} aria-hidden="true" />
            <input
              name="q"
              defaultValue={data.filters.q}
              placeholder="Match code, player or registration code"
            />
          </div>
        </label>
        <label>
          <span>Game</span>
          <select name="game" defaultValue={data.filters.game}>
            <option value="">All games</option>
            {data.gameOptions.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select name="status" defaultValue={data.filters.status}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {describeStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.filterActions}>
          <button type="submit">
            <SlidersHorizontal size={16} aria-hidden="true" /> Apply filters
          </button>
          <Link href="/admin/matches">Reset</Link>
        </div>
      </form>

      <div className={styles.tableShell}>
        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Players</th>
              <th>Score</th>
              <th>Schedule</th>
              <th>Status</th>
              <th aria-label="Open match" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.code}</strong>
                  <small>
                    {row.gameName} · {row.roundName}
                  </small>
                </td>
                <td>
                  <span>
                    {row.entrants.length
                      ? row.entrants.map((entrant) => entrant.name).join(" vs ")
                      : "Waiting for earlier results"}
                  </span>
                </td>
                <td>
                  <span>{row.displayScore ?? "No score yet"}</span>
                  <small>Updated {formatDhakaDateTime(row.updatedAt)}</small>
                </td>
                <td>
                  <span>
                    {row.scheduledAt
                      ? formatDhakaDateTime(row.scheduledAt)
                      : "Not scheduled"}
                  </span>
                  {row.station ? <small>{row.station}</small> : null}
                </td>
                <td>
                  <span className={styles.statusBadge} data-status={row.status}>
                    {describeStatus(row.status)}
                  </span>
                </td>
                <td>
                  <Link
                    className={styles.rowLink}
                    href={`/admin/matches/${row.id}`}
                    aria-label={`Open ${row.code}`}
                  >
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>No matches here</h2>
            <p>
              {data.total === 0 &&
              !data.filters.q &&
              !data.filters.status &&
              !data.filters.game
                ? "Make a draw from a game's page to create matches."
                : "Clear filters or try a different search."}
            </p>
          </div>
        ) : null}
      </div>

      {data.pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Match pages">
          <span>
            Page {data.page} of {data.pageCount}
          </span>
          <div>
            {data.page > 1 ? (
              <Link href={pageHref(data.page - 1)}>
                <ChevronLeft size={16} aria-hidden="true" /> Previous
              </Link>
            ) : null}
            {data.page < data.pageCount ? (
              <Link href={pageHref(data.page + 1)}>
                Next <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
