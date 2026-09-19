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

function getErrorMessage(error: string) {
  switch (error) {
    case "invalid_link":
      return "This setup link is invalid, expired, or already used. If you set your password, sign in below. Otherwise, request a fresh link from the event team.";
    case "access_denied":
      return "This account has no active staff access. Contact the Super Admin.";
    case "too_many_attempts":
      return "Too many sign-in attempts. Wait 15 minutes, then try again.";
    default:
      return "That email or password was not recognised. Check your details and try again.";
  }
}

export default async function StaffLoginPage({
  searchParams,
}: StaffLoginPageProps) {
  const { error } = await searchParams;

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.identity} aria-label="NDCAK staff workspace">
        <Link
          className={styles.brand}
          href="/"
          aria-label="NDCAK tournament home"
        >
          <Image
            src="/brand/ndcak-lockup.webp"
            alt="Notre Dame College Association of KUET"
            width={560}
            height={241}
            priority
          />
        </Link>

        <div className={styles.message}>
          <p>Staff workspace</p>
          <h1>Run the event with clarity.</h1>
          <span>
            Secure access for authorised administrators and score operators.
            Participant registration never requires an account.
          </span>
        </div>

        <small>Authorised NDCAK event staff only</small>
      </section>

      <section className={styles.formShell}>
        <div className={styles.formPanel}>
          <Link className={styles.back} href="/">
            <ChevronLeft size={15} aria-hidden="true" /> Back to public site
          </Link>
          <p className={styles.eyebrow}>Protected access</p>
          <h2>Staff sign in</h2>
          <span className={styles.intro}>
            Use your staff email and the password you set during account setup.
          </span>

          {error ? (
            <div className={styles.error} role="alert">
              {getErrorMessage(error)}
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
