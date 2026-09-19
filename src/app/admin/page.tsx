import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Radio,
  Ticket,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { LiveRefresh } from "@/components/live/live-refresh";
import styles from "@/features/admin/components/admin.module.css";
import {
  getDashboard,
  type Dashboard,
} from "@/features/analytics/server/dashboard";
import settingsStyles from "@/features/event/components/settings.module.css";
import { isReadyToOpen } from "@/features/event/domain/event-settings";
import { getEventSetup } from "@/features/event/server/event-queries";
import { IssueList } from "@/features/issues/components/issue-list";
import { describeUpdateType } from "@/features/matches/domain/commands";
import { formatDhakaTime } from "@/lib/dates";
import { formatBdt } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [dashboard, setup] = await Promise.all([
    getDashboard(),
    getEventSetup(),
  ]);
  const needsSetup =
    !setup ||
    (setup.tournament.status === "DRAFT" && !isReadyToOpen(setup.readiness));

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <div>
          <p>Operations</p>
          <h1>Admin dashboard</h1>
          <span>
            {dashboard
              ? `Counted from the database at ${formatDhakaTime(dashboard.generatedAt)}. Updates by itself while open.`
              : "Registrations, matches and staff at a glance."}
          </span>
        </div>
        {setup ? <LiveRefresh tournamentId={setup.tournament.id} /> : null}
      </header>

      {needsSetup ? (
        <section className={styles.dashboardAction}>
          <div>
            <p>Event setup</p>
            <h2>
              {setup
                ? `${setup.readiness.filter((check) => check.required && !check.ok).length} setup steps before registration can open`
                : "Create the tournament to get started"}
            </h2>
            <span>
              Add the event dates, venue, games and payment methods. Nothing is
              public until you open registration.
            </span>
          </div>
          <Link href="/admin/event">
            Event settings <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {dashboard ? <Overview dashboard={dashboard} /> : null}

      {setup?.games.length ? (
        <section
          className={settingsStyles.panel}
          aria-labelledby="capacity-title"
        >
          <div className={settingsStyles.panelHeading}>
            <div>
              <p>{setup.tournament.name}</p>
              <h2 id="capacity-title">Capacity by game</h2>
            </div>
            <Link className={settingsStyles.secondary} href="/admin/games">
              Manage games
            </Link>
          </div>
          <div className={settingsStyles.table}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col">Confirmed</th>
                  <th scope="col">Pending</th>
                  <th scope="col">Places left</th>
                </tr>
              </thead>
              <tbody>
                {setup.games.map((game) => {
                  const taken = game.confirmedCount + game.reservedCount;

                  return (
                    <tr key={game.id}>
                      <td>
                        <strong>{game.name}</strong>
                        <div
                          className={settingsStyles.meter}
                          aria-hidden="true"
                        >
                          <span
                            style={{
                              width: `${Math.min(100, (taken / game.capacity) * 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td>{game.confirmedCount}</td>
                      <td>{game.reservedCount}</td>
                      <td>
                        {Math.max(0, game.capacity - taken)} of {game.capacity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Overview({ dashboard }: { dashboard: Dashboard }) {
  const { registrations, fees, matches, staff, issues, delivery } = dashboard;

  return (
    <>
      {delivery.failed || delivery.waiting ? (
        <p className={styles.warnBanner} role="status">
          {delivery.failed
            ? `${delivery.failed} ${delivery.failed === 1 ? "email has" : "emails have"} failed to send. `
            : ""}
          {delivery.waiting
            ? `${delivery.waiting} ${delivery.waiting === 1 ? "email is" : "emails are"} waiting to send. `
            : ""}
          <Link
            href={`/admin/notifications?status=${delivery.failed ? "FAILED" : "QUEUED"}`}
          >
            Review email delivery
          </Link>
        </p>
      ) : null}

      <h2 className={styles.sectionTitle}>Registrations</h2>
      <section className={styles.metricGrid} aria-label="Registrations">
        <Metric
          icon={<Clock3 />}
          label="Pending review"
          value={registrations.pending}
        />
        <Metric
          icon={<CheckCircle2 />}
          label="Confirmed"
          value={registrations.confirmed}
        />
        <Metric
          icon={<XCircle />}
          label="Rejected"
          value={registrations.rejected}
        />
        <Metric
          icon={<Users />}
          label="Total submitted"
          value={registrations.total}
        />
      </section>
      <section
        className={`${styles.metricGrid} ${styles.metricGridCompact}`}
        aria-label="Entry fees and game entries"
      >
        <Metric
          icon={<Wallet />}
          label="Fees verified"
          value={formatBdt(fees.verifiedMinor)}
          note="Confirmed registrations"
        />
        <Metric
          icon={<Wallet />}
          label="Fees awaiting review"
          value={formatBdt(fees.awaitingMinor)}
          note="Registrations pending review"
        />
        <Metric
          icon={<Ticket />}
          label="Confirmed game entries"
          value={dashboard.confirmedEntries}
          note="One per player per game"
        />
        <Metric
          icon={<CircleAlert />}
          label="Open problem reports"
          value={issues.open}
          note="Flagged by staff"
        />
      </section>
      <p className={styles.metricNote}>
        Fee totals add up the amounts participants were asked to pay. Check them
        against the mobile banking statements: they are not an accounting
        record.
      </p>

      {registrations.pending ? (
        <section className={styles.dashboardAction}>
          <div>
            <p>Verification queue</p>
            <h2>
              {registrations.pending}{" "}
              {registrations.pending === 1
                ? "registration needs"
                : "registrations need"}{" "}
              a decision
            </h2>
            <span>
              Review participant details, payment references and selected games
              before approving or rejecting.
            </span>
          </div>
          <Link href="/admin/registrations?status=PENDING_REVIEW">
            Open queue <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <h2 className={styles.sectionTitle}>Matches</h2>
      <section
        className={`${styles.metricGrid} ${styles.metricGridCompact}`}
        aria-label="Matches"
      >
        <Metric icon={<Radio />} label="Live now" value={matches.live} />
        <Metric icon={<Clock3 />} label="Scheduled" value={matches.scheduled} />
        <Metric
          icon={<CheckCircle2 />}
          label="Finished"
          value={matches.finished}
          note={
            matches.total
              ? `${matches.finished} of ${matches.total}`
              : "No draw yet"
          }
        />
        <Metric
          icon={<XCircle />}
          label="Postponed or cancelled"
          value={matches.held}
        />
      </section>
      <p className={styles.metricNote}>
        {staff.operators} {staff.operators === 1 ? "operator" : "operators"} on
        duty with {staff.assignments} active{" "}
        {staff.assignments === 1 ? "assignment" : "assignments"} ·{" "}
        {staff.scoringNow} staff entered scores in the last{" "}
        {staff.windowMinutes} minutes ·{" "}
        <Link href="/admin/matches">Match monitor</Link>
      </p>

      <div className={styles.dashboardColumns}>
        <section
          className={styles.dashboardPanel}
          aria-labelledby="issues-title"
        >
          <h2 id="issues-title">Open problem reports</h2>
          <p>
            {issues.open
              ? "Newest first. Resolve them on the reports page."
              : "Nothing is waiting. Operators can flag a problem from any match."}
          </p>
          <IssueList
            issues={issues.latest}
            showMatch
            matchHref={(id) => `/admin/matches/${id}`}
          />
          <Link className={styles.panelLink} href="/admin/issues">
            All problem reports <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>

        <section
          className={styles.dashboardPanel}
          aria-labelledby="activity-title"
        >
          <h2 id="activity-title">Recent score activity</h2>
          <p>The last changes entered by operators and admins.</p>
          {dashboard.recentUpdates.length ? (
            <ol className={styles.activityList}>
              {dashboard.recentUpdates.map((update) => (
                <li key={update.id}>
                  <time dateTime={update.createdAt.toISOString()}>
                    {formatDhakaTime(update.createdAt)}
                  </time>
                  <span>
                    <Link href={`/admin/matches/${update.matchId}`}>
                      {update.matchCode}
                    </Link>{" "}
                    {describeUpdateType(update.type)}
                    <small>
                      {update.gameName} · {update.actorName}
                      {update.displayScore ? ` · ${update.displayScore}` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p>No scores entered yet.</p>
          )}
        </section>
      </div>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <article className={styles.metric}>
      <div>{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
      {note ? <small>{note}</small> : null}
    </article>
  );
}
