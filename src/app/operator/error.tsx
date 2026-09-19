"use client";

import Link from "next/link";
import styles from "@/features/operators/components/workspace.module.css";

export default function OperatorError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className={styles.page}>
      <main id="main-content" className={styles.content}>
        <div className={styles.errorState} role="alert">
          <h1>This page did not load</h1>
          <p>
            Usually a brief connection problem. Scores you already sent are
            safe, and unsent ones stay queued on this phone.
          </p>
          <div>
            <button type="button" onClick={retry}>
              Try again
            </button>
            <Link href="/operator">My matches</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
