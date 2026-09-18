import { Check, ChevronLeft, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import styles from "@/features/registration/components/registration.module.css";

export const metadata: Metadata = {
  title: "Payment information",
};

export default function RegistrationPaymentPage() {
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
        <div className={styles.reviewState}>
          <LockKeyhole size={38} aria-hidden="true" />
          <h2>Payment setup is not connected yet</h2>
          <p>
            Final submission stays disabled until the committee provides
            approved payment methods and receiving accounts. The database is
            connected, but no draft has been submitted or confirmed.
          </p>
          <Link href="/register/review">Return to review</Link>
        </div>
      </div>
    </main>
  );
}
