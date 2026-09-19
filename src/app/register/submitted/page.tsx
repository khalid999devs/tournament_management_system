import { CheckCircle2, Mail, ShieldCheck, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import styles from "@/features/registration/components/registration.module.css";

export const metadata: Metadata = {
  title: "Registration submitted",
  robots: { index: false, follow: false },
};

type SubmittedPageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function SubmittedPage({
  searchParams,
}: SubmittedPageProps) {
  const { code } = await searchParams;
  const registrationCode =
    typeof code === "string" && /^ND\d{2}-[A-F0-9]{10}$/.test(code)
      ? code
      : null;

  return (
    <div className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <main id="main-content" className="page-width">
        <section className={styles.submitted}>
          <div className={styles.submittedIcon}>
            <CheckCircle2 size={34} aria-hidden="true" />
          </div>
          <p className={styles.eyebrow}>Registration received</p>
          <h1>You are almost in.</h1>
          <p>
            Your place is held while the committee checks your payment. You will
            get a confirmation email as soon as it is approved.
          </p>
          {registrationCode ? (
            <div className={styles.code}>
              <small>Your registration code</small>
              <strong>{registrationCode}</strong>
            </div>
          ) : null}
          <ul className={styles.nextSteps}>
            <li>
              <Mail size={18} aria-hidden="true" /> A receipt is on its way to
              the email address you entered.
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden="true" /> The committee checks
              each payment by hand. Your confirmation email includes a calendar
              invite.
            </li>
            <li>
              <Ticket size={18} aria-hidden="true" /> Keep your registration
              code for check-in and any questions.
            </li>
          </ul>
          <div className={styles.submittedActions}>
            <Link className={styles.primary} href="/">
              Back to the championship
            </Link>
            <Link className={styles.secondary} href="/rulebook">
              Read the rulebook
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
