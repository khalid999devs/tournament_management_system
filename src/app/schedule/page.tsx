import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPageShell,
  publicInformationStyles as styles,
} from "@/components/brand/public-page-shell";

export const metadata: Metadata = {
  title: "Schedule",
  description: "NDCAK Indoor Games match and event schedule.",
};

export default function SchedulePage() {
  return (
    <PublicPageShell
      eyebrow="Event schedule"
      title="Know where to be. Know when to play."
      intro="Browse published sessions by day, game, and round. Final event times will appear here after the organizing committee approves the schedule."
    >
      <div className={styles.toolbar} aria-label="Schedule filters">
        <span>All games</span>
        <span>Chess</span>
        <span>Table Tennis</span>
        <span>Carrom</span>
        <span>Mobile Football</span>
      </div>
      <section className={styles.empty}>
        <div>
          <CalendarClock size={42} aria-hidden="true" />
          <h2>The match schedule is being prepared</h2>
          <p>
            Approved dates, rounds, venues, and table assignments will be
            published here. Registration details will always use the same
            official schedule.
          </p>
          <Link href="/register">Start registration</Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
