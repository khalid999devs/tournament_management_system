import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  describeStatus,
  type MatchStatus,
} from "@/features/matches/domain/commands";
import { LiveRefresh } from "@/components/live/live-refresh";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { getAdminMatchPage } from "@/features/matches/server/admin-match-queries";
import { formatDhakaDateTime } from "@/lib/dates";
import styles from "@/features/admin/components/admin.module.css";
import { FilterForm } from "@/components/filters/filter-form";
import { MatchRowEdit } from "@/features/matches/components/match-row-edit";
import { dateToDhakaInput } from "@/features/event/domain/event-settings";
import { StatusMessages } from "@/features/event/components/status-messages";

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
    message?: string;
    error?: string;
  }>;
}) {
  const filters = await searchParams;
  const [data, tournamentId] = await Promise.all([
    getAdminMatchPage(filters),
    findCurrentTournamentId(),
  ]);

  // An inline edit comes back to the same page of the same filtered list.
  const query = new URLSearchParams(
    Object.entries(filters).filter(
      ([key, value]) => Boolean(value) && key !== "message" && key !== "error",
    ) as [string, string][],
  ).toString();
  const returnTo = query ? `/admin/matches?${query}` : "/admin/matches";

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

  const exportQuery = new URLSearchParams();
  if (data.filters.game) exportQuery.set("game", data.filters.game);
  if (data.filters.status) exportQuery.set("status", data.filters.status);
  if (data.filters.q) exportQuery.set("q", data.filters.q);
  const exportHref = `/admin/reports/export/results${exportQuery.size ? `?${exportQuery.toString()}` : ""}`;

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
        <div className={styles.headerTools}>
          <a className={styles.exportLink} href={exportHref} download>
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
          {tournamentId ? (
            <LiveRefresh tournamentId={tournamentId} kinds={["match"]} />
          ) : null}
        </div>
      </header>

      <StatusMessages message={filters.message} error={filters.error} />

      <FilterForm action="/admin/matches" className={styles.filters}>
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
      </FilterForm>

      <div
        className={styles.tableShell}
        role="region"
        aria-label="Matches"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Players</th>
              <th>Score</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Edit</th>
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
                <td data-label="Players">
                  <span>
                    {row.entrants.length
                      ? row.entrants.map((entrant) => entrant.name).join(" vs ")
                      : "Waiting for earlier results"}
                    {row.entrants.length === 1 ? " vs to be decided" : ""}
                  </span>
                </td>
                <td data-label="Score" className={styles.nowrapCell}>
                  <span>{row.displayScore ?? "No score yet"}</span>
                  <small>Updated {formatDhakaDateTime(row.updatedAt)}</small>
                </td>
                <td data-label="Schedule" className={styles.nowrapCell}>
                  <span>
                    {row.scheduledAt
                      ? formatDhakaDateTime(row.scheduledAt)
                      : "Time not set"}
                  </span>
                  {row.station ? <small>{row.station}</small> : null}
                </td>
                <td data-label="Status">
                  <span className={styles.statusBadge} data-status={row.status}>
                    {describeStatus(row.status)}
                  </span>
                </td>
                <td data-label="Edit">
                  <MatchRowEdit
                    matchId={row.id}
                    code={row.code}
                    scheduledAt={dateToDhakaInput(row.scheduledAt)}
                    station={row.station ?? ""}
                    status={row.status}
                    returnTo={returnTo}
                  />
                </td>
                <td className={styles.linkCell}>
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
