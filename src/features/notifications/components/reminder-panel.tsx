import Link from "next/link";
import styles from "@/features/event/components/settings.module.css";
import { formatDhakaDate } from "@/lib/dates";
import { reminderDayOptions } from "../domain/reminders";
import {
  saveReminderSettingAction,
  sendRemindersNowAction,
} from "../server/actions";
import { getReminderSummary } from "../server/reminders";

export async function ReminderPanel() {
  const summary = await getReminderSummary();
  if (!summary) return null;

  const scheduled = !summary.startsAt
    ? "Set the event start date first."
    : !summary.sendDay
      ? "Off. No reminder is sent."
      : `${formatDhakaDate(`${summary.sendDay}T12:00:00+06:00`)}, around 9 to 10 am`;

  return (
    <section
      className={styles.panel}
      id="reminders"
      aria-labelledby="reminders-title"
    >
      <div className={styles.panelHeading}>
        <div>
          <p>Communication</p>
          <h2 id="reminders-title">Reminder email</h2>
          <span>
            One email with their games, the date, the venue and check-in
            details.
          </span>
        </div>
      </div>

      <form className={styles.formGrid} action={saveReminderSettingAction}>
        <label className={styles.field}>
          <span>When to send it</span>
          <select
            name="daysBefore"
            defaultValue={summary.daysBefore?.toString() ?? ""}
          >
            <option value="">Do not send a reminder</option>
            {reminderDayOptions.map((days) => (
              <option key={days} value={days}>
                {days} {days === 1 ? "day" : "days"} before the event
              </option>
            ))}
          </select>
        </label>
        <div className={styles.actions}>
          <button className={styles.secondary} type="submit">
            Save reminder setting
          </button>
        </div>
      </form>

      <dl className={`${styles.stats} ${styles.statsFour}`}>
        <div className={styles.statText}>
          <dt>Scheduled for</dt>
          <dd>{scheduled}</dd>
        </div>
        <div>
          <dt>Confirmed players</dt>
          <dd>{summary.confirmed}</dd>
        </div>
        <div>
          <dt>Sent</dt>
          <dd>{summary.sent}</dd>
        </div>
        <div>
          <dt>Waiting</dt>
          <dd>{summary.waiting}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>
            {summary.failed ? (
              <Link href="/admin/notifications?type=EVENT_REMINDER&status=FAILED">
                {summary.failed}
              </Link>
            ) : (
              0
            )}
          </dd>
        </div>
      </dl>

      <form className={styles.stack} action={sendRemindersNowAction}>
        <p className={styles.checkHelp}>
          Sends now to every confirmed player who has not had it. Each player
          gets it once.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            type="submit"
            disabled={!summary.startsAt}
          >
            Send the reminder now
          </button>
        </div>
      </form>
    </section>
  );
}
