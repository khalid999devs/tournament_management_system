import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/brand/public-header";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import styles from "./staff.module.css";

export const metadata: Metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};

export default async function StaffPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/staff/login");
  }

  const email =
    typeof data.claims.email === "string"
      ? data.claims.email
      : "Authenticated staff account";

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <PublicHeader />
      </div>
      <section className={`${styles.content} page-width`}>
        <p className={styles.eyebrow}>Verified Supabase session</p>
        <h1>Your staff workspace is connected.</h1>
        <p className={styles.intro}>
          Authentication is live. Role-aware admin and operator navigation will
          unlock only after the application schema and staff profile are
          provisioned.
        </p>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span>Signed in as</span>
              <strong>{email}</strong>
            </div>
            <span className={styles.status}>Identity verified</span>
          </div>
          <h2>Fail-closed authorization</h2>
          <p>
            This page confirms identity only. It does not grant an admin or
            operator role; role and assignment checks remain unavailable until
            the database migration is applied.
          </p>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </article>
      </section>
    </main>
  );
}
