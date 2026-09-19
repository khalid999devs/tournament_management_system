import { Check, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import { RegistrationPayment } from "@/features/registration/components/registration-payment";
import styles from "@/features/registration/components/registration.module.css";
import { getRegistrationCheckout } from "@/features/tournaments/server/get-registration-tournament";

export const metadata: Metadata = {
  title: "Payment information",
};

export const revalidate = 60;

export default async function RegistrationPaymentPage() {
  const checkout = await getRegistrationCheckout();

  return (
    <main className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <section className={`${styles.intro} page-width`}>
        <Link href="/register/review">
          <ChevronLeft size={16} aria-hidden="true" /> Back to review
        </Link>
        <div>
          <p>Participant registration</p>
          <h1>Submit payment information.</h1>
          <span>
            The configured receiving account and exact expected amount will
            appear here before final submission.
          </span>
        </div>
        <ol className={styles.steps} aria-label="Registration progress">
          <li className={styles.complete}>
            <b>
              <Check size={14} aria-label="Completed" />
            </b>
            Details
          </li>
          <li className={styles.complete}>
            <b>
              <Check size={14} aria-label="Completed" />
            </b>
            Review
          </li>
          <li className={styles.active} aria-current="step">
            <b>3</b> Payment
          </li>
        </ol>
      </section>
      <div className="page-width">
        {checkout ? (
          <RegistrationPayment checkout={checkout} />
        ) : (
          <div className={styles.reviewState}>
            <h2>Registration is not open</h2>
            <p>
              Payment and final submission become available when the approved
              event configuration is published.
            </p>
            <Link href="/register/review">Return to review</Link>
          </div>
        )}
      </div>
    </main>
  );
}
