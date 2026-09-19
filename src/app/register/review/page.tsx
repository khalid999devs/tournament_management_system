import type { Metadata } from "next";
import Link from "next/link";
import { RegistrationReview } from "@/features/registration/components/registration-review";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import styles from "@/features/registration/components/registration.module.css";
import { getRegistrationTournament } from "@/features/tournaments/server/get-registration-tournament";

export const metadata: Metadata = {
  title: "Review registration",
};

export const revalidate = 60;

export default async function RegistrationReviewPage() {
  const tournament = await getRegistrationTournament();

  return (
    <RegistrationShell
      step={2}
      back={{ href: "/register", label: "Back to details" }}
      title="Check your registration."
      lead="Nothing is submitted yet. Make sure everything is right before you pay."
    >
      {tournament ? (
        <RegistrationReview
          games={tournament.games}
          maxGames={tournament.maxGamesPerParticipant}
        />
      ) : (
        <div className={styles.state}>
          <h2>Registration is closed</h2>
          <p>
            Registration is not open at the moment, so nothing can be submitted.
          </p>
          <Link className={styles.primary} href="/">
            Back to the championship
          </Link>
        </div>
      )}
    </RegistrationShell>
  );
}
