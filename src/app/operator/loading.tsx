import { PageSkeleton } from "@/components/feedback/page-skeleton";
import styles from "@/features/operators/components/workspace.module.css";

export default function OperatorLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <PageSkeleton label="Loading your workload" />
      </div>
    </main>
  );
}
