import { ChevronLeft, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "./actions";
import styles from "./staff-login.module.css";

export const metadata: Metadata = {
  title: "Staff login",
  robots: { index: false, follow: false },
};

type StaffLoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffLoginPage({
  searchParams,
}: StaffLoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <section className={styles.identity} aria-label="NDCAK staff workspace">
        <Link
          className={styles.brand}
          href="/"
          aria-label="NDCAK tournament home"
        >
          <Image
            src="/brand/ndcak-lockup.png"
            alt="Notre Dame College Association of KUET"
            width={1536}
            height={700}
            priority
          />
        </Link>

        <div className={styles.message}>
          <p>Staff workspace</p>
          <h1>Run the event with clarity.</h1>
          <span>
            Secure access for authorized administrators and score operators.
            Participant registration never requires an account.
          </span>
        </div>

        <small>Authorized NDCAK event staff only</small>
      </section>

      <section className={styles.formShell}>
        <div className={styles.formPanel}>
          <Link className={styles.back} href="/">
            <ChevronLeft size={15} aria-hidden="true" /> Back to public site
          </Link>
          <p>Protected access</p>
          <h2>Staff sign in</h2>
          <span className={styles.intro}>
            Use the email and password issued by the event administrator.
          </span>

          {error ? (
            <div className={styles.error} role="alert">
              The credentials or sign-in link could not be verified. Try again
              or contact the Super Admin.
            </div>
          ) : null}

          <form className={styles.form} action={signIn}>
            <label>
              Email address
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                required
                type="email"
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>
            <button type="submit">
              <LockKeyhole size={16} aria-hidden="true" /> Sign in securely
            </button>
          </form>

          <p className={styles.support}>
            Staff accounts are created by the Super Admin. There is no public
            staff registration.
          </p>
        </div>
      </section>
    </main>
  );
}
