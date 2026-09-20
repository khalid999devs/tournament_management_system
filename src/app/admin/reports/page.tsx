import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import styles from "@/features/admin/components/admin.module.css";
import { getExportOptions } from "@/features/analytics/server/exports";
import settingsStyles from "@/features/event/components/settings.module.css";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const options = await getExportOptions();

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <div>
          <p>Reports</p>
          <h1>Exports</h1>
          <span>
            Every matching row, not just one page. Downloads are logged: these
            files hold contact details.
          </span>
        </div>
      </header>

      {!options ? (
        <div
          className={styles.tableShell}
          role="region"
          aria-label="Report contents"
          tabIndex={0}
        >
          <div className={styles.emptyState}>
            <h2>Nothing to export yet</h2>
            <p>Create the tournament in Event settings first.</p>
          </div>
        </div>
      ) : (
        <div className={styles.reportGrid}>
          <ReportCard
            kind="registrations"
            title="Registrations"
            description="Contact details, games, fee and payment reference."
          >
            <Select name="status" label="Status">
              <option value="ALL">All statuses</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Select name="game" label="Game">
              <option value="">All games</option>
              {options.games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </Select>
          </ReportCard>

          <ReportCard
            kind="participants"
            title="Confirmed players by game"
            description="One row per player per game. Good for check-in sheets."
          >
            <Select name="game" label="Game">
              <option value="">All games</option>
              {options.games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </Select>
            <Select name="department" label="Department">
              <option value="">All departments</option>
              {options.departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </Select>
          </ReportCard>

          <ReportCard
            kind="payments"
            title="Payment verification"
            description="Transaction IDs and amounts, to check against your banking statement."
          >
            <Select name="status" label="Payment status">
              <option value="">All</option>
              <option value="SUBMITTED">Awaiting review</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </Select>
            <Select name="provider" label="Method">
              <option value="">All methods</option>
              {options.providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </Select>
            <DateRange />
          </ReportCard>

          <ReportCard
            kind="results"
            title="Match results"
            description="Every match with its players, placings and final score."
          >
            <Select name="game" label="Game">
              <option value="">All games</option>
              {options.games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </Select>
            <Select name="status" label="Status">
              <option value="">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="WALKOVER">Walkover</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="POSTPONED">Postponed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </ReportCard>

          <ReportCard
            kind="activity"
            title="Operator activity"
            description="Every score change, and who entered it."
          >
            <Select name="staff" label="Staff member">
              <option value="">Everyone</option>
              {options.staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
            <DateRange />
          </ReportCard>
        </div>
      )}
      <p className={styles.metricNote}>
        Times are in Dhaka time. Amounts are what participants were asked to
        pay; they are not an accounting record. Other screens:{" "}
        <Link href="/admin/registrations">Registrations</Link>,{" "}
        <Link href="/admin/matches">Match monitor</Link>.
      </p>
    </div>
  );
}

function ReportCard({
  kind,
  title,
  description,
  children,
}: {
  kind: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={settingsStyles.panel}
      aria-labelledby={`report-${kind}`}
    >
      <div className={settingsStyles.panelHeading}>
        <div>
          <h2 id={`report-${kind}`}>{title}</h2>
          <span>{description}</span>
        </div>
      </div>
      <form
        className={settingsStyles.formGrid}
        method="get"
        action={`/admin/reports/export/${kind}`}
      >
        {children}
        <div className={settingsStyles.actions}>
          <button className={settingsStyles.primary} type="submit">
            <Download size={16} aria-hidden="true" /> Download CSV
          </button>
        </div>
      </form>
    </section>
  );
}

function Select({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={settingsStyles.field}>
      <span>{label}</span>
      <select name={name} defaultValue="">
        {children}
      </select>
    </label>
  );
}

function DateRange() {
  return (
    <>
      <label className={settingsStyles.field}>
        <span>From</span>
        <input type="date" name="from" />
      </label>
      <label className={settingsStyles.field}>
        <span>To</span>
        <input type="date" name="to" />
      </label>
    </>
  );
}
