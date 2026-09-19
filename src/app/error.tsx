"use client";

import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import styles from "@/components/feedback/status-page.module.css";

export default function AppError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <PublicHeader />
      </div>
      <main id="main-content" className={styles.main}>
        <div className="page-width" role="alert">
          <p className={styles.eyebrow}>Something went wrong</p>
          <h1>This page could not load.</h1>
          <p className={styles.lead}>
            It is usually a brief connection problem. Nothing you submitted
            earlier is lost. Try again in a moment.
          </p>
          <div className={styles.actions}>
            <button
              className="button button-primary"
              type="button"
              onClick={() => retry()}
            >
              Try again
            </button>
            <Link className="button button-quiet" href="/">
              Event home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
