import type { Metadata } from "next";
import Link from "next/link";
import { RegistrationDetailsForm } from "@/features/registration/components/registration-details-form";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import styles from "@/features/registration/components/registration.module.css";
import { getRegistrationTournament } from "@/features/tournaments/server/get-registration-tournament";

export const metadata: Metadata = {
  title: "Register",
  description: "Register for the NDCAK Indoor Games Championship.",
};

export const revalidate = 60;

export default async function RegisterPage() {
  const tournament = await getRegistrationTournament();

  return (
    <RegistrationShell
      step={1}
      back={{ href: "/", label: "Back to the championship" }}
      title="Register to play."
      lead="Pick your games and pay once for all of them. No account needed."
    >
      {tournament ? (
        <RegistrationDetailsForm
          games={tournament.games}
          maxGames={tournament.maxGamesPerParticipant}
          departments={tournament.departments}
          academicYears={tournament.academicYears}
        />
      ) : (
        <div className={styles.state}>
          <h2>Registration is not open yet</h2>
          <p>
            Games, fees and payment details will be published here when
            registration opens. Check back soon.
          </p>
          <Link className={styles.primary} href="/">
            Back to the championship
          </Link>
        </div>
      )}
    </RegistrationShell>
  );
}
