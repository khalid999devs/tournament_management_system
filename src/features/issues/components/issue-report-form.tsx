"use client";

import { Send } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { issueCategories } from "../domain/issues";
import { reportIssueAction, type ReportIssueState } from "../server/actions";
import styles from "./issues.module.css";

const initialState: ReportIssueState = { status: "idle" };

export function IssueReportForm({
  matchId,
  onReported,
}: {
  matchId: string | null;
  onReported?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    reportIssueAction,
    initialState,
  );
  // One id per report, reused if the same report is sent again after a
  // lost response; a fresh one once it has gone through.
  const draftId = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "success") onReported?.();
  }, [state, onReported]);

  const submit = (formData: FormData) => {
    if (!draftId.current || draftId.current === state.doneId) {
      draftId.current = crypto.randomUUID();
    }
    formData.set("clientRequestId", draftId.current);
    formAction(formData);
  };

  return (
    <form className={styles.form} action={submit}>
      {matchId ? <input type="hidden" name="matchId" value={matchId} /> : null}
      <label className={styles.field}>
        <span>What kind of problem?</span>
        <select name="category" required defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          {Object.entries(issueCategories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>What happened?</span>
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Seat 2 left after the first set and has not come back"
        />
      </label>
      {state.status !== "idle" ? (
        <p
          className={state.status === "error" ? styles.error : styles.success}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
      <button className={styles.submit} type="submit" disabled={pending}>
        <Send size={16} aria-hidden="true" />
        {pending ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
