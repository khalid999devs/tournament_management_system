import type { Metadata } from "next";
import { requireStaffPage } from "@/features/auth/server/staff-session";
import { setStaffPassword } from "./actions";
import styles from "./set-password.module.css";

export const metadata: Metadata = {
  title: "Set staff password",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const staff = await requireStaffPage();
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>NDCAK staff workspace</p>
        <h1>Secure your account.</h1>
        <p>
          Welcome, {staff.displayName}. Set a password before opening your
          assigned tournament work.
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error === "invalid_password"
              ? "Use at least 12 characters and make sure both entries match."
              : "Your password could not be updated. Please try again."}
          </p>
        ) : null}
        <form action={setStaffPassword}>
          <label>
            New password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              name="confirmation"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <button type="submit">Set password and continue →</button>
        </form>
      </section>
    </main>
  );
}
