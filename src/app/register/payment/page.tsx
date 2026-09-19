import type { Metadata } from "next";
import Link from "next/link";
import { RegistrationPayment } from "@/features/registration/components/registration-payment";
import { RegistrationShell } from "@/features/registration/components/registration-shell";
import styles from "@/features/registration/components/registration.module.css";
import { getRegistrationCheckout } from "@/features/tournaments/server/get-registration-tournament";

export const metadata: Metadata = {
  title: "Payment",
};

export const revalidate = 60;

export default async function RegistrationPaymentPage() {
  const checkout = await getRegistrationCheckout();

  return (
    <RegistrationShell
      step={3}
      back={{ href: "/register/review", label: "Back to review" }}
      title="Pay and submit."
      lead="Send the total by mobile banking, then enter the transaction ID from your receipt. Your place is held as soon as you submit."
    >
      {checkout ? (
        <RegistrationPayment checkout={checkout} />
      ) : (
        <div className={styles.state}>
          <h2>Registration is closed</h2>
          <p>
            Registration is not open at the moment, so no payment can be
            submitted.
          </p>
          <Link className={styles.primary} href="/">
            Back to the championship
          </Link>
        </div>
      )}
    </RegistrationShell>
  );
}
