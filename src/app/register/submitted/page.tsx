import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
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
    <main className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <section className={`${styles.submittedState} page-width`}>
        <div className={styles.submittedIcon}>
          <CheckCircle2 size={38} aria-hidden="true" />
        </div>
        <p>Registration received</p>
        <h1>Pending manual review.</h1>
        <span>
          Your submission is saved, but your place is not confirmed until the
          event team verifies the payment reference.
        </span>
        {registrationCode ? (
          <div className={styles.registrationCode}>
            <small>Registration code</small>
            <strong>{registrationCode}</strong>
          </div>
        ) : null}
        <div className={styles.submittedNotes}>
          <span>
            <Mail size={18} aria-hidden="true" /> A receipt is queued for the
            email address you provided.
          </span>
          <span>
            <ShieldCheck size={18} aria-hidden="true" /> Keep the registration
            code for support and check-in.
          </span>
        </div>
        <Link href="/">Return to tournament home</Link>
      </section>
    </main>
  );
}
