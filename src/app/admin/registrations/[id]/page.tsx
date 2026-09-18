import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import {
  approveRegistrationAction,
  rejectRegistrationAction,
} from "@/features/admin/server/actions";
import { getAdminRegistrationDetail } from "@/features/admin/server/registration-queries";
import { formatDhakaDateTime } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import styles from "@/features/admin/components/admin.module.css";

export const metadata: Metadata = { title: "Registration review" };
export const dynamic = "force-dynamic";

type RegistrationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
};

export default async function RegistrationDetailPage({
  params,
  searchParams,
}: RegistrationDetailPageProps) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const registration = await getAdminRegistrationDetail(id);

  if (!registration) notFound();
  const pending = registration.status === "PENDING_REVIEW";

  return (
    <div className={styles.content}>
      <Link className={styles.backLink} href="/admin/registrations">
        <ArrowLeft size={16} aria-hidden="true" /> Back to registrations
      </Link>
      <header className={styles.detailHeader}>
        <div>
          <p>Registration review</p>
          <h1>{registration.code}</h1>
          <span>Submitted {formatDhakaDateTime(registration.submittedAt)}</span>
        </div>
        <span className={styles.statusBadge} data-status={registration.status}>
          {registration.status.replaceAll("_", " ")}
        </span>
      </header>

      {feedback.message ? (
        <div className={styles.successBanner} role="status">
          The registration was {feedback.message}. Database changes were saved;
          email delivery is tracked separately.
        </div>
      ) : null}
      {feedback.error ? (
        <div className={styles.errorBanner} role="alert">
          {getReviewError(feedback.error)}
        </div>
      ) : null}

      <div className={styles.detailGrid}>
        <section className={styles.detailCard}>
          <h2>Participant</h2>
          <dl>
            <Detail label="Full name" value={registration.participantName} />
            <Detail label="Student ID" value={registration.studentId} />
            <Detail label="Email" value={registration.email} />
            <Detail label="Phone" value={registration.phone} />
            <Detail label="Department" value={registration.department} />
            <Detail label="Academic year" value={registration.academicYear} />
          </dl>
        </section>

        <section className={styles.detailCard}>
          <h2>Payment evidence</h2>
          <dl>
            <Detail label="Method" value={registration.paymentProvider} />
            <Detail
              label="Receiving account"
              value={registration.receivingAccount}
            />
            <Detail
              label="Expected amount"
              value={formatBdt(registration.expectedAmountMinor)}
            />
            <Detail label="Transaction ID" value={registration.transactionId} />
            <Detail label="Payment status" value={registration.paymentStatus} />
          </dl>
        </section>

        <section className={`${styles.detailCard} ${styles.detailWide}`}>
          <h2>Selected games</h2>
          <ul className={styles.entryList}>
            {registration.entries.map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{entry.gameName}</strong>
                  <small>{entry.status}</small>
                </span>
                <b>{formatBdt(entry.feeMinor)}</b>
              </li>
            ))}
          </ul>
          <div className={styles.detailTotal}>
            <span>Total expected</span>
            <strong>{formatBdt(registration.totalFeeMinor)}</strong>
          </div>
        </section>
      </div>

      {pending ? (
        <section className={styles.reviewActionsPanel}>
          <div>
            <h2>Record a decision</h2>
            <p>
              Approval verifies payment and confirms all game entries. Rejection
              releases every reserved slot.
            </p>
          </div>
          <form action={approveRegistrationAction}>
            <input
              type="hidden"
              name="registrationId"
              value={registration.id}
            />
            <button className={styles.approveButton} type="submit">
              <CheckCircle2 size={18} aria-hidden="true" /> Approve registration
            </button>
          </form>
          <form className={styles.rejectForm} action={rejectRegistrationAction}>
            <input
              type="hidden"
              name="registrationId"
              value={registration.id}
            />
            <label>
              Participant-safe rejection reason
              <textarea name="reason" minLength={3} maxLength={1000} required />
            </label>
            <button type="submit">
              <XCircle size={18} aria-hidden="true" /> Reject and release slots
            </button>
          </form>
        </section>
      ) : (
        <section className={styles.closedDecision}>
          <h2>Review complete</h2>
          <p>
            {registration.reviewedAt
              ? `Decision recorded ${formatDhakaDateTime(registration.reviewedAt)}.`
              : "This registration is no longer pending."}
          </p>
          {registration.rejectionReason ? (
            <p>Reason: {registration.rejectionReason}</p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getReviewError(code: string) {
  const messages: Record<string, string> = {
    already_reviewed: "Another review already completed this registration.",
    reason_required: "Enter a clear rejection reason.",
    configuration_incomplete:
      "Set the tournament start and end time before approval so the calendar invitation is accurate.",
    capacity_inconsistent:
      "Capacity counters are inconsistent. No review changes were saved.",
    review_failed: "The decision could not be saved. Try again.",
  };

  return messages[code] ?? "The decision could not be saved.";
}
