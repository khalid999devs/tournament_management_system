import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Clock3, Users, XCircle } from "lucide-react";
import { getAdminDashboardMetrics } from "@/features/admin/server/registration-queries";
import styles from "@/features/admin/components/admin.module.css";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const metrics = await getAdminDashboardMetrics();

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
