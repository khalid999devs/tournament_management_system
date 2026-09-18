import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import styles from "./public-information.module.css";

type PublicPageShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  intro: string;
  title: string;
};

export function PublicPageShell({
  children,
  eyebrow,
  intro,
  title,
}: PublicPageShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <PublicHeader />
      </div>
      <section className={styles.hero}>
        <div className="page-width">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{intro}</span>
        </div>
      </section>
      <div className={`${styles.content} page-width`}>{children}</div>
      <PublicFooter />
    </main>
  );
}

export { styles as publicInformationStyles };
