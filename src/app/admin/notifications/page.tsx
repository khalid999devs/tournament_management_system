import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { retryNotificationAction } from "@/features/admin/server/actions";
import { getAdminNotificationPage } from "@/features/admin/server/notification-queries";
import { formatDhakaDateTime } from "@/lib/dates";
import styles from "@/features/admin/components/admin.module.css";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const data = await getAdminNotificationPage(params);

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <div>
          <p>Delivery operations</p>
          <h1>Notifications</h1>
          <span>
            {data.total} delivery records. Failed messages can be retried
            without changing registration state.
          </span>
        </div>
      </header>

      {params.message === "retry_queued" ? (
        <div className={styles.successBanner} role="status">
          Retry started. Refresh to see the provider result.
        </div>
      ) : null}

      <form className={styles.notificationFilters} method="get">
        <label className={styles.searchField}>
          <span>Recipient search</span>
          <div>
            <Search size={16} aria-hidden="true" />
            <input
              name="q"
              defaultValue={data.filters.q}
              placeholder="participant@example.com"
            />
          </div>
        </label>
        <label>
          <span>Status</span>
          <select name="status" defaultValue={data.filters.status}>
            <option value="ALL">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENDING">Sending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select name="sort" defaultValue={data.filters.sort}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <div className={styles.filterActions}>
          <button type="submit">Apply</button>
          <Link href="/admin/notifications">Reset</Link>
        </div>
      </form>

      <div className={styles.tableShell}>
        <table>
          <thead>
            <tr>
              <th>Notification</th>
              <th>Recipient</th>
              <th>Registration</th>
              <th>Attempts</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.type.replaceAll("_", " ")}</strong>
                  <small>{formatDhakaDateTime(row.createdAt)}</small>
                </td>
                <td>
                  <span>{row.recipientEmail}</span>
                  {row.errorText ? <small>{row.errorText}</small> : null}
                </td>
                <td>
                  {row.registrationId ? (
                    <Link href={`/admin/registrations/${row.registrationId}`}>
                      {row.registrationCode}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{row.retryCount}</td>
                <td>
                  <span className={styles.statusBadge} data-status={row.status}>
                    {row.status}
                  </span>
                </td>
                <td>
                  {row.status === "FAILED" || row.status === "QUEUED" ? (
                    <form action={retryNotificationAction}>
                      <input
                        type="hidden"
                        name="notificationId"
                        value={row.id}
                      />
                      <button className={styles.retryButton} type="submit">
                        <RotateCcw size={14} aria-hidden="true" /> Retry
                      </button>
                    </form>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>No notifications found</h2>
            <p>Delivery records appear after participant submissions.</p>
          </div>
        ) : null}
      </div>

      <nav className={styles.pagination} aria-label="Notification pages">
        <span>
          Page {data.filters.page} of {data.pageCount}
        </span>
        <div>
          {data.filters.page > 1 ? (
            <Link href={pageHref(raw, data.filters.page - 1)}>
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </Link>
          ) : null}
          {data.filters.page < data.pageCount ? (
            <Link href={pageHref(raw, data.filters.page + 1)}>
              Next <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}

function pageHref(
  input: Record<string, string | string[] | undefined>,
  page: number,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first && key !== "page" && key !== "message") params.set(key, first);
  }

  params.set("page", String(page));
  return `/admin/notifications?${params.toString()}`;
}
