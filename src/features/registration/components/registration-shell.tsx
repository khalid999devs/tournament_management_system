import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "@/components/brand/public-header";
import styles from "./registration.module.css";

const stepNames = ["Details", "Review", "Payment"];

// Shared frame for the three registration steps. The back link and the
// progress share one row, so the title sits right above the form.
export function RegistrationShell({
  step,
  back,
  title,
  lead,
  children,
}: {
  step: 1 | 2 | 3;
  back: { href: string; label: string };
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.headerShell}>
        <PublicHeader />
      </div>
      <section className={`${styles.intro} page-width`}>
        <Link className={styles.back} href={back.href}>
          <ChevronLeft size={16} aria-hidden="true" /> {back.label}
        </Link>
        <ol
          className={styles.steps}
          aria-label={`Registration progress: step ${step} of 3`}
        >
          {stepNames.map((name, index) => {
            const number = index + 1;
            const state =
              number < step ? "done" : number === step ? "current" : "next";
            return (
              <li
                key={name}
                className={
                  state === "done"
                    ? styles.done
                    : state === "current"
                      ? styles.current
                      : undefined
                }
                aria-current={state === "current" ? "step" : undefined}
              >
                <span className={styles.stepNumber}>
                  {state === "done" ? (
                    <Check size={14} strokeWidth={3} aria-label="Completed" />
                  ) : (
                    number
                  )}
                </span>
                <span className={styles.stepName}>{name}</span>
              </li>
            );
          })}
        </ol>
        <div className={styles.heading}>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </div>
      </section>
      <div className="page-width">{children}</div>
    </main>
  );
}
