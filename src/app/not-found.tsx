import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/brand/public-footer";
import { PublicHeader } from "@/components/brand/public-header";
import styles from "@/components/feedback/status-page.module.css";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <PublicHeader />
      </div>
      <main id="main-content" className={styles.main}>
        <div className="page-width">
          <p className={styles.eyebrow}>Page not found</p>
          <h1>This page is not on the board.</h1>
          <p className={styles.lead}>
            The link may be old or mistyped. Everything about the championship
            is one step away.
          </p>
          <div className={styles.actions}>
            <Link className="button button-primary" href="/">
              Event home <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="button button-quiet" href="/schedule">
              Schedule
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
