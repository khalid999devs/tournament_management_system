import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import styles from "@/features/admin/components/admin.module.css";

export default function AdminNotFound() {
  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <div>
          <p>Not found</p>
          <h1>This item is not here</h1>
          <span>
            It may have been removed, or the link is incomplete. Open it again
            from the list.
          </span>
        </div>
      </header>
      <Link className={styles.exportLink} href="/admin">
        <ArrowLeft size={15} aria-hidden="true" /> Back to the dashboard
      </Link>
    </div>
  );
}
