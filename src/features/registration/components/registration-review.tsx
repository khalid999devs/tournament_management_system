"use client";

import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { calculateRegistrationQuote } from "@/features/registration/domain/quote";
import {
  createRegistrationDetailsSchema,
  type RegistrationDetails,
} from "@/features/registration/domain/schemas";
import type { RegistrationGameOption } from "@/features/registration/domain/types";
import { formatBdt } from "@/lib/money";
import { draftStorageKey } from "./registration-details-form";
import styles from "./registration.module.css";

type RegistrationReviewProps = {
  games: RegistrationGameOption[];
  maxGames: number;
};

export function RegistrationReview({
  games,
  maxGames,
}: RegistrationReviewProps) {
  const storedDraft = useSyncExternalStore(
    subscribeToDraft,
    readDraft,
    getServerDraft,
  );
  const details = useMemo(
    () => parseDraft(storedDraft, maxGames),
    [maxGames, storedDraft],
  );

  if (details === undefined) {
    return (
      <div className={styles.reviewState}>Loading your registration draft…</div>
    );
  }

  if (details === null) {
    return (
      <div className={styles.reviewState}>
        <h2>No registration draft found</h2>
        <p>Start with your student information and game selection.</p>
        <Link href="/register">Start registration</Link>
      </div>
    );
  }

  const quote = calculateRegistrationQuote(
    games,
    details.selectedGameIds,
    maxGames,
  );

  return (
    <div className={styles.reviewLayout}>
      <section className={styles.panel}>
        <div className={styles.reviewHeading}>
          <div>
            <p>Registration review</p>
            <h2>Check everything before payment.</h2>
          </div>
          <ShieldCheck size={38} aria-hidden="true" />
        </div>

        <dl className={styles.reviewDetails}>
          <ReviewItem label="Full name" value={details.fullName} />
          <ReviewItem label="Student ID" value={details.studentId} />
          <ReviewItem label="Email" value={details.email} />
          <ReviewItem label="Phone" value={details.phone} />
          <ReviewItem label="Department" value={details.department} wide />
          <ReviewItem label="Academic year" value={details.academicYear} />
        </dl>
      </section>

      <aside className={styles.quotePanel}>
        <p>Selected games</p>
        <ul>
          {quote.lines.map((line) => (
            <li key={line.gameId}>
              <span>
                <strong>{line.name}</strong>
                <small>
                  {line.remainingCapacity} places currently available
                </small>
              </span>
              <b>{formatBdt(line.feeMinor)}</b>
            </li>
          ))}
        </ul>
        <div className={styles.quoteTotal}>
          <span>Total expected fee</span>
          <strong>{formatBdt(quote.totalFeeMinor)}</strong>
        </div>
        <p className={styles.pendingNote}>
          Payment information is reviewed manually. Submission does not confirm
          a place until the event team approves it.
        </p>
      </aside>

      <div className={styles.reviewActions}>
        <Link href="/register">
          <ArrowLeft size={17} aria-hidden="true" /> Edit details
        </Link>
        <Link className={styles.primaryAction} href="/register/payment">
          Proceed to payment <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function subscribeToDraft() {
  return () => undefined;
}

function readDraft() {
  return window.sessionStorage.getItem(draftStorageKey);
}

function getServerDraft() {
  return undefined;
}

function parseDraft(
  storedDraft: string | null | undefined,
  maxGames: number,
): RegistrationDetails | null | undefined {
  if (storedDraft === undefined) return undefined;
  if (storedDraft === null) return null;

  try {
    const parsed = createRegistrationDetailsSchema(maxGames).safeParse(
      JSON.parse(storedDraft),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function ReviewItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? styles.reviewItemWide : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
