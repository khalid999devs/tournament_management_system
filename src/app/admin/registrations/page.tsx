import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { LiveRefresh } from "@/components/live/live-refresh";
import { getAdminRegistrationPage } from "@/features/admin/server/registration-queries";
import { findCurrentTournamentId } from "@/features/event/server/event-queries";
import { formatDhakaDateTime } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import styles from "@/features/admin/components/admin.module.css";

export const metadata: Metadata = { title: "Registrations" };
export const dynamic = "force-dynamic";

type RegistrationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegistrationsPage({
  searchParams,
}: RegistrationsPageProps) {
  const rawParams = await searchParams;
  const params = firstValues(rawParams);
  const [data, tournamentId] = await Promise.all([
    getAdminRegistrationPage(params),
    findCurrentTournamentId(),
  ]);

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <div>
          <p>Admin verification</p>
          <h1>Registrations</h1>
          <span>
            {data.total} submissions. Filters, sort, and page are stored in the
            URL.
          </span>
        </div>
        <div className={styles.headerTools}>
          <a
            className={styles.exportLink}
            href={exportHref(rawParams)}
            download
          >
            <Download size={15} aria-hidden="true" /> Export CSV
          </a>
          {tournamentId ? (
            <LiveRefresh tournamentId={tournamentId} kinds={["registration"]} />
          ) : null}
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
              placeholder="Code, student, email, phone, transaction"
            />
          </div>
        </label>
        <FilterSelect label="Status" name="status" value={data.filters.status}>
          <option value="ALL">All statuses</option>
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </FilterSelect>
        <FilterSelect label="Game" name="game" value={data.filters.game}>
          <option value="">All games</option>
          {data.options.games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Department"
          name="department"
          value={data.filters.department}
        >
          <option value="">All departments</option>
          {data.options.departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Payment"
          name="provider"
          value={data.filters.provider}
        >
          <option value="">All methods</option>
          {data.options.providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Sort" name="sort" value={data.filters.sort}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Participant name</option>
        </FilterSelect>
        <label>
          <span>From</span>
          <input type="date" name="from" defaultValue={data.filters.from} />
        </label>
        <label>
          <span>To</span>
          <input type="date" name="to" defaultValue={data.filters.to} />
        </label>
        <div className={styles.filterActions}>
          <button type="submit">
            <SlidersHorizontal size={16} aria-hidden="true" /> Apply filters
          </button>
          <Link href="/admin/registrations">Reset</Link>
        </div>
      </form>

      <div className={styles.tableShell}>
        <table>
          <thead>
            <tr>
              <th>Registration</th>
              <th>Participant</th>
              <th>Games</th>
              <th>Payment</th>
              <th>Status</th>
              <th aria-label="Open registration" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.code}</strong>
                  <small>{formatDhakaDateTime(row.submittedAt)}</small>
                </td>
                <td>
                  <strong>{row.participantName}</strong>
                  <small>
                    {row.studentId} · {row.department}
                  </small>
                </td>
                <td>
                  <span>{row.gameNames}</span>
                  <small>{formatBdt(row.totalFeeMinor)}</small>
                </td>
                <td>
                  <strong>{row.paymentProvider}</strong>
                  <small>{row.transactionId}</small>
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <Link
                    className={styles.rowLink}
                    href={`/admin/registrations/${row.id}`}
                    aria-label={`Review ${row.code}`}
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
            <h2>No registrations match these filters</h2>
            <p>Clear filters or try a different search.</p>
          </div>
        ) : null}
      </div>

      <nav className={styles.pagination} aria-label="Registration pages">
        <span>
          Page {data.filters.page} of {data.pageCount}
        </span>
        <div>
          {data.filters.page > 1 ? (
            <Link href={pageHref(rawParams, data.filters.page - 1)}>
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </Link>
          ) : null}
          {data.filters.page < data.pageCount ? (
            <Link href={pageHref(rawParams, data.filters.page + 1)}>
              Next <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}

function FilterSelect({
  children,
  label,
  name,
  value,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {children}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function firstValues(input: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

function pageHref(
  input: Record<string, string | string[] | undefined>,
  page: number,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first && key !== "page") params.set(key, first);
  }

  params.set("page", String(page));
  return `/admin/registrations?${params.toString()}`;
}

// Every row matching the current filters, not just this page.
function exportHref(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first && key !== "page") params.set(key, first);
  }

  const query = params.toString();
  return `/admin/reports/export/registrations${query ? `?${query}` : ""}`;
}
