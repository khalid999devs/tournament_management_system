"use client";

import styles from "@/features/admin/components/admin.module.css";

export default function AdminError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHeader} role="alert">
        <div>
          <p>Could not load</p>
          <h1>This page did not load</h1>
          <span>
            Usually a brief connection problem. Nothing was changed. Try again
            in a moment.
          </span>
        </div>
      </header>
      <button className={styles.exportLink} type="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
