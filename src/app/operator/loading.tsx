import { PageSkeleton } from "@/components/feedback/page-skeleton";
import styles from "@/features/operators/components/workspace.module.css";

export default function OperatorLoading() {
  return (
    <div className={styles.page}>
      <main id="main-content" className={styles.content}>
        <PageSkeleton label="Loading your workload" />
      </main>
    </div>
  );
}
