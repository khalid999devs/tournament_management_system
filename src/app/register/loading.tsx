import { PublicHeader } from "@/components/brand/public-header";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import styles from "@/features/registration/components/registration.module.css";

export default function RegistrationLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <div className="page-width">
        <PageSkeleton label="Loading registration" />
      </div>
    </main>
  );
}
