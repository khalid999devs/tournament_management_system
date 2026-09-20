"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import {
  postponeMatchAction,
  resumeMatchAction,
  updateMatchScheduleAction,
} from "../server/actions";
import styles from "./match-row-edit.module.css";

/**
 * Time, table and status, changed without leaving the match monitor. Editing
 * a time never touches the score, which is why it needs no reason; postponing
 * does, so that box only appears when it is the action being taken.
 */
export function MatchRowEdit({
  matchId,
  code,
  scheduledAt,
  station,
  status,
  returnTo,
}: {
  matchId: string;
  code: string;
  scheduledAt: string;
  station: string;
  status: string;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);
  const canPostpone = status === "SCHEDULED" || status === "IN_PROGRESS";
  const canResume = status === "POSTPONED";

  if (!open) {
    return (
      <button
        type="button"
        className={styles.edit}
        onClick={() => setOpen(true)}
        aria-label={`Edit ${code}`}
      >
        <Pencil size={14} aria-hidden="true" />
        Edit
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <strong>Editing {code}</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={`Stop editing ${code}`}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <form action={updateMatchScheduleAction} className={styles.fields}>
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label>
          <span>Start time</span>
          <input
            type="datetime-local"
            name="scheduledAt"
            defaultValue={scheduledAt}
          />
        </label>
        <label>
          <span>Table or station</span>
          <input
            name="station"
            maxLength={80}
            defaultValue={station}
            placeholder="e.g. Table 3"
          />
        </label>
        <button type="submit" className={styles.save}>
          Save
        </button>
      </form>

      {canPostpone ? (
        <form action={postponeMatchAction} className={styles.statusForm}>
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>
            <span>Postpone, with a reason</span>
            <input
              name="reason"
              required
              minLength={5}
              maxLength={500}
              placeholder="e.g. the table is being repaired"
            />
          </label>
          <button type="submit">Postpone</button>
        </form>
      ) : null}

      {canResume ? (
        <form action={resumeMatchAction} className={styles.statusForm}>
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit">Resume match</button>
        </form>
      ) : null}
    </div>
  );
}
