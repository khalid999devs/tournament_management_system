"use client";

import { ArrowRight, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { tryRegistrationQuote } from "@/features/registration/domain/quote";
import {
  createRegistrationDetailsSchema,
  type RegistrationDetails,
} from "@/features/registration/domain/schemas";
import type { RegistrationGameOption } from "@/features/registration/domain/types";
import { formatBdt } from "@/lib/money";
import { GamesChanged } from "./games-changed";
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
    return <div className={styles.state}>Loading your registration…</div>;
  }

  if (details === null) {
    return (
      <div className={styles.state}>
        <h2>Nothing to review yet</h2>
        <p>Start with your details and the games you want to play.</p>
        <Link className={styles.primary} href="/register">
          Start registration
        </Link>
      </div>
    );
  }

  const priced = tryRegistrationQuote(games, details.selectedGameIds, maxGames);
  if (!priced.ok) return <GamesChanged message={priced.message} />;
  const { quote } = priced;

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.card} aria-labelledby="review-details">
          <div className={styles.cardHeader}>
            <span className={styles.cardNumber}>1</span>
            <div>
              <h2 id="review-details">Your details</h2>
              <p>Your confirmation and match updates go to this email.</p>
            </div>
            <Link className={styles.cardHeaderAction} href="/register">
              <Pencil size={14} aria-hidden="true" /> Edit
            </Link>
          </div>
          <dl className={styles.detailsList}>
            <ReviewItem label="Full name" value={details.fullName} />
            <ReviewItem label="Student ID" value={details.studentId} />
            <ReviewItem label="Department" value={details.department} />
            <ReviewItem label="Academic year" value={details.academicYear} />
            <ReviewItem label="Email" value={details.email} />
            <ReviewItem label="Phone" value={details.phone} />
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="review-games">
          <div className={styles.cardHeader}>
            <span className={styles.cardNumber}>2</span>
            <div>
              <h2 id="review-games">Your games</h2>
              <p>
                Places are held once you submit, and confirmed after the payment
                check.
              </p>
            </div>
            <Link className={styles.cardHeaderAction} href="/register">
              <Pencil size={14} aria-hidden="true" /> Change
            </Link>
          </div>
          <ul className={styles.summaryList}>
            {quote.lines.map((line) => (
              <li key={line.gameId}>
                <span>{line.name}</span>
                <b>{formatBdt(line.feeMinor)}</b>
              </li>
            ))}
          </ul>
          <div className={styles.summaryTotal}>
            <span>Total fee</span>
            <strong>{formatBdt(quote.totalFeeMinor)}</strong>
          </div>
        </section>
      </div>

      <aside
        className={`${styles.summary} ${styles.summaryStatic}`}
        aria-label="Next step"
      >
        <p className={styles.summaryTitle}>Next: payment</p>
        <div className={styles.summaryTotal}>
          <span>Amount to pay</span>
          <strong>{formatBdt(quote.totalFeeMinor)}</strong>
        </div>
        <div className={styles.reviewActions}>
          <Link className={styles.primary} href="/register/payment">
            Continue to payment <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className={styles.secondary} href="/register">
            Edit registration
          </Link>
        </div>
        <p className={styles.summaryNote}>
          You send the fee by mobile banking and enter the transaction ID. The
          committee checks every payment before confirming your place.
        </p>
      </aside>
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

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
