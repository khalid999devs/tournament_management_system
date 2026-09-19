import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildOperationalEmail } from "@/features/notifications/domain/operational-email";
import { buildRegistrationEmail } from "@/features/notifications/domain/registration-email";
import { EmailFrame } from "./email-frame";
import styles from "./preview.module.css";

export const metadata: Metadata = {
  title: "Email design preview",
  robots: { index: false, follow: false },
};

const states = [
  "pending",
  "confirmed",
  "rejected",
  "reminder",
  "schedule",
  "support",
  "invitation",
] as const;

type State = (typeof states)[number];

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { state: rawState } = await searchParams;
  const state: State = states.includes(rawState as State)
    ? (rawState as State)
    : "pending";
  const email = await previewEmail(state);

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <p>NDCAK design lab</p>
          <h1>Transactional email</h1>
          <span>Preview fixtures only. This page never sends a message.</span>
        </div>
        <Link href="/">Back to site</Link>
      </div>
      <nav className={styles.tabs} aria-label="Email states">
        {states.map((option) => (
          <Link
            key={option}
            href={`/dev/email-preview?state=${option}`}
            aria-current={option === state ? "page" : undefined}
          >
            {option}
          </Link>
        ))}
      </nav>
      <div className={styles.canvas}>
        <div className={styles.subject}>
          <strong>Subject</strong>
          <span>{email.subject}</span>
        </div>
        <EmailFrame
          title={`${state} email preview`}
          html={email.html}
          className={styles.frame}
        />
      </div>
    </main>
  );
}

async function previewEmail(state: State) {
  const shared = {
    recipientName: "Alex Rahman",
    tournamentName: "NDCAK Indoor Games Championship",
    supportEmail: "ndcakofficial@gmail.com",
  };

  if (state === "pending" || state === "confirmed" || state === "rejected") {
    return buildRegistrationEmail({
      type:
        state === "pending"
          ? "REGISTRATION_SUBMITTED"
          : state === "confirmed"
            ? "REGISTRATION_APPROVED"
            : "REGISTRATION_REJECTED",
      registrationId: "00000000-0000-4000-8000-000000000001",
      registrationCode: "ND26-EXAMPLE",
      participantName: shared.recipientName,
      recipientEmail: "alex@example.com",
      tournamentName: shared.tournamentName,
      tournamentSlug: "ndcak-indoor-games",
      timezone: "Asia/Dhaka",
      venue: "SWC Indoor Arena",
      startsAt: new Date("2026-09-24T03:00:00.000Z"),
      endsAt: new Date("2026-09-26T12:00:00.000Z"),
      checkInInstructions: "Bring your student ID to the check-in desk.",
      rejectionReason: "The payment reference could not be verified.",
      gameNames: ["Chess", "Carrom"],
      organizerEmail: shared.supportEmail,
    });
  }

  if (state === "reminder") {
    return buildOperationalEmail({
      ...shared,
      type: "EVENT_REMINDER",
      registrationCode: "ND26-EXAMPLE",
      schedule: "Thursday, 24 September · 9:00 AM",
      venue: "SWC Indoor Arena",
      checkInInstructions:
        "Bring your student ID and arrive early for check-in.",
    });
  }

  if (state === "schedule") {
    return buildOperationalEmail({
      ...shared,
      type: "SCHEDULE_CHANGED",
      registrationCode: "ND26-EXAMPLE",
      previousSchedule: "Thursday, 24 September · 9:00 AM",
      newSchedule: "Friday, 25 September · 10:00 AM",
      venue: "SWC Indoor Arena",
      eventPageUrl: "https://example.com/schedule",
    });
  }

  if (state === "support") {
    return buildOperationalEmail({
      ...shared,
      type: "SUPPORT_ACKNOWLEDGMENT",
      supportReference: "HELP-EXAMPLE",
      topic: "registration status",
    });
  }

  return buildOperationalEmail({
    ...shared,
    type: "OPERATOR_INVITE",
    invitationUrl:
      "https://example.com/auth/confirm?token_hash=preview&type=invite",
    expiresDescription: "is time-limited",
  });
}
