import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import { RegistrationDetailsForm } from "@/features/registration/components/registration-details-form";
import { getRegistrationTournament } from "@/features/tournaments/server/get-registration-tournament";
import styles from "@/features/registration/components/registration.module.css";

export const metadata: Metadata = {
  title: "Register",
  description: "Register once for your selected NDCAK Indoor Games events.",
};

export const revalidate = 60;

export default async function RegisterPage() {
  const tournament = await getRegistrationTournament();

  return (
    <main className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <section className={`${styles.intro} page-width`}>
        <Link href="/">
          <ChevronLeft size={16} aria-hidden="true" /> Back to event
        </Link>
        <div>
          <p>Participant registration</p>
          <h1>One form. Every game you choose.</h1>
          <span>
            Complete your details, review the combined fee, and submit one
            payment reference. No participant account is required.
          </span>
        </div>
        <ol className={styles.steps} aria-label="Registration progress">
          <li className={styles.active} aria-current="step">
            <b>1</b> Details
          </li>
          <li>
            <b>2</b> Review
          </li>
          <li>
            <b>3</b> Payment
          </li>
        </ol>
      </section>
      <div className="page-width">
        {tournament ? (
          <RegistrationDetailsForm
            games={tournament.games}
            maxGames={tournament.maxGamesPerParticipant}
          />
        ) : (
          <div className={styles.reviewState}>
            <h2>Registration is not open yet</h2>
            <p>
              The event team is finalizing games, capacity, fees, and payment
              instructions. No application can be submitted until the approved
              configuration is published.
            </p>
            <Link href="/">Return to event home</Link>
          </div>
        )}
      </div>
    </main>
  );
}
