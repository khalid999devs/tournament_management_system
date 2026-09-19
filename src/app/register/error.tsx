"use client";

import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import styles from "@/features/registration/components/registration.module.css";

export default function RegistrationError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <div className="page-width">
        <div className={styles.reviewState} role="alert">
          <h2>Registration is taking longer than usual</h2>
          <p>
            We could not load the event details just now. Nothing has been
            submitted, and any details you entered are still saved on this
            device.
          </p>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/">Return to event home</Link>
        </div>
      </div>
    </main>
  );
}
