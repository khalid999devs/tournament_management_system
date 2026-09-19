import { PublicHeader } from "@/components/brand/public-header";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import styles from "@/features/registration/components/registration.module.css";

export default function RegistrationLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <main id="main-content" className="page-width">
        <PageSkeleton label="Loading registration" />
      </main>
    </div>
  );
}
