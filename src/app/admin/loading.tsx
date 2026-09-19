import { PageSkeleton } from "@/components/feedback/page-skeleton";
import styles from "@/features/admin/components/admin.module.css";

export default function AdminLoading() {
  return (
    <div className={styles.content}>
      <PageSkeleton label="Loading admin page" blocks={4} />
    </div>
  );
}
