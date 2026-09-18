import { Check, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import { RegistrationReview } from "@/features/registration/components/registration-review";
import styles from "@/features/registration/components/registration.module.css";
import { getRegistrationTournament } from "@/features/tournaments/server/get-registration-tournament";

export const metadata: Metadata = {
  title: "Review registration",
};

export const dynamic = "force-dynamic";

export default async function RegistrationReviewPage() {
  const tournament = await getRegistrationTournament();

  return (
    <main className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <section className={`${styles.intro} page-width`}>
        <Link href="/register">
          <ChevronLeft size={16} aria-hidden="true" /> Back to details
        </Link>
        <div>
          <p>Participant registration</p>
          <h1>Review your registration.</h1>
          <span>
            Nothing is submitted yet. Confirm your details and selected games
            before proceeding to payment.
          </span>
        </div>
        <ol className={styles.steps} aria-label="Registration progress">
          <li className={styles.complete}>
            <b>
              <Check size={14} aria-label="Completed" />
            </b>
            Details
          </li>
          <li className={styles.active} aria-current="step">
            <b>2</b> Review
          </li>
          <li>
            <b>3</b> Payment
          </li>
        </ol>
      </section>
      <div className="page-width">
        {tournament ? (
          <RegistrationReview
            games={tournament.games}
            maxGames={tournament.maxGamesPerParticipant}
          />
        ) : (
          <div className={styles.reviewState}>
            <h2>Registration is not open</h2>
            <p>
              Live event configuration is not available yet. Your browser draft
              has not been submitted.
            </p>
            <Link href="/">Return to event home</Link>
          </div>
        )}
      </div>
    </main>
  );
}
