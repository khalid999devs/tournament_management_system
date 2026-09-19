import { CalendarClock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPageShell,
  publicInformationStyles as styles,
} from "@/components/brand/public-page-shell";
import { getPublicEvent } from "@/features/tournaments/server/get-registration-tournament";
import { formatDhakaDateRange } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Schedule",
  description: "NDCAK Indoor Games Championship match and event schedule.",
};

export const revalidate = 60;

export default async function SchedulePage() {
  const event = await getPublicEvent().catch(() => null);

  return (
    <PublicPageShell
      eyebrow="Match days"
      title="Schedule."
      intro="Match days, rounds and tables for every game are published here once the draw is made."
    >
      <div className={styles.informationGrid}>
        <section className={styles.empty}>
          <div>
            <CalendarClock size={42} aria-hidden="true" />
            <h2>The draw has not been made yet</h2>
            <p>
              Fixtures are drawn after registration closes. Confirmed players
              receive the event dates and check-in details by email.
            </p>
            <Link href="/register">Registration details</Link>
          </div>
        </section>
        <aside className={styles.sideCard}>
          <MapPin size={22} aria-hidden="true" />
          <p>Event details</p>
          <dl>
            <div>
              <dt>Venue</dt>
              <dd>{event?.venue ?? "KUET Campus, Khulna"}</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                {event?.startsAt
                  ? formatDhakaDateRange(event.startsAt, event.endsAt)
                  : "To be announced"}
              </dd>
            </div>
            <div>
              <dt>Reporting time</dt>
              <dd>Published with the fixtures</dd>
            </div>
          </dl>
        </aside>
      </div>
    </PublicPageShell>
  );
}
