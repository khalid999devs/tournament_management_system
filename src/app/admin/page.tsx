import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Clock3, Users, XCircle } from "lucide-react";
import { getAdminDashboardMetrics } from "@/features/admin/server/registration-queries";
import styles from "@/features/admin/components/admin.module.css";
import settingsStyles from "@/features/event/components/settings.module.css";
import { isReadyToOpen } from "@/features/event/domain/event-settings";
import { getEventSetup } from "@/features/event/server/event-queries";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [metrics, setup] = await Promise.all([
    getAdminDashboardMetrics(),
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
            Registration verification and delivery health at a glance.
          </span>
        </div>
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

      <section className={styles.metricGrid} aria-label="Registration metrics">
        <Metric
          icon={<Clock3 />}
          label="Pending review"
          value={metrics.pending}
        />
        <Metric
          icon={<CheckCircle2 />}
          label="Confirmed"
          value={metrics.confirmed}
        />
        <Metric icon={<XCircle />} label="Rejected" value={metrics.rejected} />
        <Metric
          icon={<Users />}
          label="Total submitted"
          value={metrics.total}
        />
      </section>

      <section className={styles.dashboardAction}>
        <div>
          <p>Verification queue</p>
          <h2>{metrics.pending} registrations need a decision</h2>
          <span>
            Review participant details, payment references, and selected games
            before approving or rejecting.
          </span>
        </div>
        <Link href="/admin/registrations?status=PENDING_REVIEW">
          Open queue <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

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

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <article className={styles.metric}>
      <div>{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
