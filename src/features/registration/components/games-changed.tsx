import Link from "next/link";
import styles from "./registration.module.css";

// Shown when a chosen game filled up or closed after it was picked.
export function GamesChanged({ message }: { message: string }) {
  return (
    <div className={styles.state} role="alert">
      <h2>Your games need a change</h2>
      <p>
        {message} Nothing was submitted, and your details are still saved on
        this device.
      </p>
      <Link className={styles.primary} href="/register">
        Change games
      </Link>
    </div>
  );
}
