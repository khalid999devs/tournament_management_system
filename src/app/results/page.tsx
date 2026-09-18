import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPageShell,
  publicInformationStyles as styles,
} from "@/components/brand/public-page-shell";

export const metadata: Metadata = {
  title: "Results",
  robots: { index: false, follow: false },
};

export default function ResultsPage() {
  return (
    <PublicPageShell
      eyebrow="Official results"
      title="Follow the championship."
      intro="Only organizer-approved live and completed results will be shown. In-progress scoring remains an internal operational view until publication is enabled."
    >
      <section className={styles.empty}>
        <div>
          <Trophy size={42} aria-hidden="true" />
          <h2>Results are not published yet</h2>
          <p>
            This page will show approved match outcomes, brackets, and final
            placements when public results are enabled for the event.
          </p>
          <Link href="/schedule">View schedule</Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
