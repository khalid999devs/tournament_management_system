import { CalendarClock, MapPin } from "lucide-react";
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
      eyebrow="Full event plan"
      title="Schedule and event details."
      intro="Browse published sessions by day, game, and round. Final event times will appear here after the organizing committee approves the schedule."
    >
      <div className={styles.toolbar} aria-label="Schedule day filters">
        <span>All days</span>
        <span>Day 1</span>
        <span>Day 2</span>
        <span>Day 3</span>
      </div>
      <div className={styles.informationGrid}>
        <section className={styles.empty}>
          <div>
            <CalendarClock size={42} aria-hidden="true" />
            <h2>The match schedule is being prepared</h2>
            <p>
              Approved dates, rounds, venues, and table assignments will be
              published here. Registration details will always use the same
              official schedule.
            </p>
            <Link href="/register">Registration information</Link>
          </div>
        </section>
        <aside className={styles.sideCard}>
          <MapPin size={22} aria-hidden="true" />
          <p>Event details</p>
          <dl>
            <div>
              <dt>Venue</dt>
              <dd>KUET Campus</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>Awaiting committee approval</dd>
            </div>
            <div>
              <dt>Reporting time</dt>
              <dd>Published with the final schedule</dd>
            </div>
          </dl>
        </aside>
      </div>
    </PublicPageShell>
  );
}
