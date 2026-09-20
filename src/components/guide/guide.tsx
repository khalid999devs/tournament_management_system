"use client";

import { useRef, type ReactNode } from "react";
import { BookOpen, X } from "lucide-react";
import styles from "./guide.module.css";

/**
 * A panel's own manual, opened from a button in its heading. A native modal
 * dialog, so Escape closes it and focus stays inside while it is open.
 *
 * Its own text rules are written as `.dialog .body p` rather than `.body p`:
 * the dialog sits in the top layer but still inherits the cascade from the
 * panel heading it lives in, and headings style their own paragraphs.
 */
export function Guide({
  label = "How this works",
  title,
  children,
}: {
  label?: string;
  title: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => dialog.current?.showModal()}
      >
        <BookOpen size={15} aria-hidden="true" />
        {label}
      </button>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="guide-title"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <header className={styles.dialogHead}>
          <h2 id="guide-title">{title}</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close the guide"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </dialog>
    </>
  );
}
