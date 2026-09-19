"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Loader2,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IssueList } from "@/features/issues/components/issue-list";
import { IssueReportForm } from "@/features/issues/components/issue-report-form";
import {
  buildScoringContext,
  getScoringAdapter,
} from "@/features/scoring/adapters";
import type { CanonicalResult } from "@/features/scoring/domain/types";
import { describeStatus } from "../domain/commands";
import type { MatchState } from "../server/match-queries";
import { describeLogItem, formatClock, seatName } from "./describe";
import { panels } from "./score-panels";
import styles from "./score-console.module.css";
import { useMatchSync, type OutboxItem } from "./use-match-sync";

function outboxText(item: OutboxItem) {
  if (item.status === "failed") return item.message ?? "Not accepted";
  if (item.status === "retrying") return item.message ?? "Waiting to retry";
  if (item.status === "sending") return "Sending…";
  return "Queued";
}

export function ScoreConsole({
  initial,
  actorId,
}: {
  initial: MatchState;
  actorId: string;
}) {
  const sync = useMatchSync(initial, actorId);
  const { state, outbox } = sync;
  const router = useRouter();
  const lastStatus = useRef(initial.status);

  // Controls around the console (admin reopen, operator lists) are server
  // rendered, so re-render them when the match changes state.
  useEffect(() => {
    if (state.status === lastStatus.current) return;
    lastStatus.current = state.status;
    router.refresh();
  }, [state.status, router]);
  const adapter = getScoringAdapter(state.adapterKey);
  const context = useMemo(
    () =>
      buildScoringContext({
        adapterKey: state.adapterKey,
        config: state.config,
        seats: state.entrants.map((entrant) => entrant.seat),
        progressionMode: state.progressionMode,
      }),
    [state.adapterKey, state.config, state.entrants, state.progressionMode],
  );

  // What the score will be once queued actions land, so fast tapping reads
  // correctly. The status line says whether everything is saved yet.
  const projected = useMemo(() => {
    let score = state.score;
    for (const item of outbox) {
      if (item.status === "failed") break;
      if (item.command.type !== "EVENT" || !adapter.eventSchema) continue;
      try {
        score = adapter.applyEvent(
          score,
          adapter.eventSchema.parse(item.command.event),
          context,
        );
      } catch {
        break;
      }
    }
    return score;
  }, [state.score, outbox, adapter, context]);

  const [confirming, setConfirming] = useState(false);
  const [tapError, setTapError] = useState<string | null>(null);
  const [absent, setAbsent] = useState<number[]>([]);
  const [walkoverNote, setWalkoverNote] = useState("");

  const live = state.status === "SCHEDULED" || state.status === "IN_PROGRESS";
  const openIssues = state.issues.filter(
    (issue) => issue.status === "OPEN",
  ).length;
  // The problems section opens when a new report arrives and otherwise stays
  // as the user left it, so a resolution is seen rather than folded away.
  const [problemsOpen, setProblemsOpen] = useState(openIssues > 0);
  const [seenOpenIssues, setSeenOpenIssues] = useState(openIssues);
  if (openIssues !== seenOpenIssues) {
    setSeenOpenIssues(openIssues);
    if (openIssues > seenOpenIssues) setProblemsOpen(true);
  }
  const ready =
    state.pendingFeeders === 0 && state.entrants.length >= adapter.seats.min;
  const failed = outbox.find((item) => item.status === "failed");
  const idle = outbox.length === 0;
  const canScore = state.permissions.score && live && ready && sync.leader;
  const canFinalize = state.permissions.finalize && live && sync.leader;

  const emit = (event: Record<string, unknown>, label: string) => {
    // Check locally first so an obviously invalid tap never enters the queue.
    try {
      adapter.applyEvent(projected, adapter.eventSchema!.parse(event), context);
    } catch (error) {
      setTapError((error as Error).message);
      return;
    }
    setTapError(null);
    sync.enqueue({ type: "EVENT", event }, label);
  };

  let preview: CanonicalResult | null = null;
  let previewProblem: string | null = null;
  if (state.adapterKey !== "CHESS_OUTCOME") {
    try {
      preview = adapter.finalize(projected, context);
    } catch (error) {
      previewProblem = (error as Error).message;
    }
  }

  const Panel = panels[state.adapterKey];
  const statusClass = {
    SCHEDULED: styles.statusScheduled,
    IN_PROGRESS: styles.statusLive,
    COMPLETED: styles.statusDone,
    WALKOVER: styles.statusDone,
    POSTPONED: styles.statusHold,
    CANCELLED: styles.statusHold,
  }[state.status];

  return (
    <div className={styles.console}>
      <header className={styles.matchHeader}>
        <div>
          <p>
            {state.gameName} · {state.roundName}
          </p>
          <h1>{state.code}</h1>
          <span>
            {[state.station, state.venue].filter(Boolean).join(" · ") ||
              "Location to be announced"}
          </span>
        </div>
        <span className={`${styles.status} ${statusClass}`}>
          {describeStatus(state.status)}
        </span>
      </header>

      <div className={styles.syncBar} role="status" aria-live="polite">
        {!sync.online ? (
          <span className={styles.syncWarn}>
            <CloudOff size={16} aria-hidden="true" /> Offline. Actions are kept
            on this device and sent when the connection returns.
          </span>
        ) : failed ? (
          <span className={styles.syncError}>
            <AlertTriangle size={16} aria-hidden="true" /> An action needs your
            attention.
          </span>
        ) : outbox.length ? (
          <span className={styles.syncBusy}>
            <Loader2 size={16} aria-hidden="true" className={styles.spin} />{" "}
            Saving {outbox.length} {outbox.length === 1 ? "action" : "actions"}…
          </span>
        ) : (
          <span className={styles.syncOk}>
            <CheckCircle2 size={16} aria-hidden="true" /> All saved · version{" "}
            {state.version}
          </span>
        )}
        <span className={styles.syncTools}>
          <span
            className={styles.liveTag}
            data-status={sync.liveStatus}
            title={
              sync.liveStatus === "live"
                ? "Changes from other screens appear instantly."
                : "Changes from other screens appear within a few seconds."
            }
          >
            {sync.liveStatus === "live"
              ? "Live"
              : sync.liveStatus === "connecting"
                ? "Connecting"
                : "Reconnecting"}
          </span>
          <button
            type="button"
            onClick={() => void sync.refresh(true)}
            aria-label="Check for updates"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </span>
      </div>

      {sync.signedOut ? (
        <div className={styles.alert} role="alert">
          Your session ended. <a href="/staff/login">Sign in again</a> in
          another tab. Queued actions stay on this device and can be sent
          afterwards.
        </div>
      ) : null}

      {!sync.leader ? (
        <div className={styles.alert} role="alert">
          This match is open in another tab or window on this device. Scoring
          stays there to keep actions in order.{" "}
          <button
            type="button"
            className={styles.linkButton}
            onClick={sync.takeOver}
          >
            Score here instead
          </button>
        </div>
      ) : null}

      {outbox.length ? (
        <ul className={styles.outbox} aria-label="Actions waiting to be saved">
          {outbox.map((item) => (
            <li
              key={item.clientEventId}
              className={
                item.status === "failed" ? styles.outboxFailed : undefined
              }
            >
              <span>
                <strong>{item.label}</strong>
                <small>{outboxText(item)}</small>
              </span>
              {item.status === "failed" ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => sync.discard(item.clientEventId)}
                >
                  Dismiss
                </button>
              ) : item.status === "retrying" ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => sync.retryNow(item.clientEventId)}
                >
                  Send now
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!ready && live ? (
        <div className={styles.notice}>
          {state.pendingFeeders
            ? "Waiting for the previous round: this match fills in when the earlier match is confirmed."
            : "Not every competitor is in this match yet."}
        </div>
      ) : null}

      {state.status === "POSTPONED" ? (
        <div className={styles.notice}>
          This match is postponed. An admin must resume it before scoring
          continues.
        </div>
      ) : null}

      {tapError ? (
        <div className={styles.alert} role="alert">
          {tapError}{" "}
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setTapError(null)}
          >
            OK
          </button>
        </div>
      ) : null}

      {live ? (
        <section className={styles.card} aria-label="Score entry">
          {state.entrants.length === 0 ? (
            <p className={styles.hint}>No competitors yet.</p>
          ) : (
            <Panel
              adapter={adapter}
              context={context}
              score={projected}
              entrants={state.entrants}
              disabled={!canScore || Boolean(failed)}
              emit={emit}
              setScore={(score, label) =>
                sync.enqueue(
                  { type: "SET_SCORE", expectedVersion: state.version, score },
                  label,
                )
              }
              finalizeWith={(score, label) =>
                sync.enqueue(
                  { type: "FINALIZE", expectedVersion: state.version, score },
                  label,
                )
              }
              canFinalize={canFinalize && ready}
              busy={!idle}
            />
          )}
          {live &&
          state.status === "SCHEDULED" &&
          ready &&
          state.permissions.score ? (
            <button
              type="button"
              className={styles.secondary}
              disabled={!idle || !sync.leader}
              onClick={() => sync.enqueue({ type: "START" }, "Start match")}
            >
              Mark as started
            </button>
          ) : null}
        </section>
      ) : null}

      {live && state.adapterKey !== "CHESS_OUTCOME" && ready ? (
        <section className={styles.card} aria-labelledby="finalize-title">
          <h2 id="finalize-title">Confirm the result</h2>
          {preview ? (
            <p className={styles.preview}>
              <strong>{preview.displayScore}</strong>
              {preview.winnerSeats.length
                ? ` · Winner: ${preview.winnerSeats.map((seat) => seatName(state.entrants, seat)).join(", ")}`
                : " · No single winner"}
            </p>
          ) : (
            <p className={styles.hint}>{previewProblem}</p>
          )}
          {!state.permissions.finalize ? (
            <p className={styles.hint}>
              Your assignment does not include confirming results.
            </p>
          ) : !idle ? (
            <p className={styles.hint}>Wait until every action is saved.</p>
          ) : confirming ? (
            <div className={styles.confirmRow}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  sync.enqueue(
                    { type: "FINALIZE", expectedVersion: state.version },
                    `Final result ${preview?.displayScore ?? ""}`,
                  );
                  setConfirming(false);
                }}
              >
                Yes, confirm final result
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setConfirming(false)}
              >
                Keep scoring
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.primary}
              disabled={!preview || !canFinalize}
              onClick={() => setConfirming(true)}
            >
              Finalize result
            </button>
          )}
          <p className={styles.hint}>
            After confirming, only an admin can reopen the result.
          </p>
        </section>
      ) : null}

      {live && state.permissions.finalize && state.pendingFeeders === 0 ? (
        <details className={styles.card}>
          <summary className={styles.summary}>
            A competitor did not show up
          </summary>
          <p className={styles.hint}>
            Tick who is absent. The one competitor present wins by walkover; if
            nobody came, no one advances.
          </p>
          {state.entrants.map((entrant) => (
            <label key={entrant.seat} className={styles.radio}>
              <input
                type="checkbox"
                checked={absent.includes(entrant.seat)}
                onChange={(event) =>
                  setAbsent(
                    event.target.checked
                      ? [...absent, entrant.seat]
                      : absent.filter((seat) => seat !== entrant.seat),
                  )
                }
              />
              {entrant.name}
            </label>
          ))}
          <label className={styles.field}>
            <span>Note</span>
            <input
              value={walkoverNote}
              maxLength={300}
              onChange={(event) => setWalkoverNote(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.danger}
            disabled={
              !idle ||
              !sync.leader ||
              state.entrants.length - absent.length > 1 ||
              (absent.length === 0 && state.entrants.length > 1)
            }
            onClick={() => {
              sync.enqueue(
                {
                  type: "WALKOVER",
                  expectedVersion: state.version,
                  absentSeats: absent,
                  note: walkoverNote.trim() || undefined,
                },
                "Walkover",
              );
              setAbsent([]);
            }}
          >
            Record walkover
          </button>
        </details>
      ) : null}

      {!live && state.result ? (
        <section className={styles.card} aria-labelledby="result-title">
          <h2 id="result-title">Final result</h2>
          <p className={styles.preview}>
            <strong>{state.displayScore}</strong>
          </p>
          <ol className={styles.rankList}>
            {[...state.entrants]
              .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
              .map((entrant) => (
                <li key={entrant.seat}>
                  <span>
                    {entrant.placement ? `#${entrant.placement} ` : ""}
                    {entrant.name}
                  </span>
                  <small>{entrant.outcome ?? ""}</small>
                </li>
              ))}
          </ol>
          {state.nextMatch ? (
            <p className={styles.hint}>
              The winner moves on to {state.nextMatch.code}.
            </p>
          ) : null}
        </section>
      ) : null}

      {state.permissions.report || state.issues.length ? (
        <details
          className={styles.card}
          open={problemsOpen}
          onToggle={(event) => setProblemsOpen(event.currentTarget.open)}
        >
          <summary className={styles.summary}>
            {openIssues
              ? `Problems reported (${openIssues} open)`
              : "Report a problem"}
          </summary>
          <div className={styles.issueBody}>
            <p className={styles.hint}>
              Flags this match for the admins, for example a no-show, a disputed
              score or a broken table. It does not change the score.
            </p>
            {state.permissions.report ? (
              <IssueReportForm
                matchId={state.id}
                onReported={() => void sync.refresh(true)}
              />
            ) : null}
            <IssueList
              issues={state.issues}
              resolveReturnTo={
                state.permissions.admin
                  ? `/admin/matches/${state.id}`
                  : undefined
              }
            />
          </div>
        </details>
      ) : null}

      <section className={styles.card} aria-labelledby="log-title">
        <h2 id="log-title">Match log</h2>
        <p className={styles.hint}>
          Server time decides the order; the device time shows when the button
          was pressed.
        </p>
        {state.log.length === 0 ? (
          <p className={styles.hint}>Nothing recorded yet.</p>
        ) : (
          <ol className={styles.log}>
            {state.log.map((item) => {
              const lag = item.deviceTime
                ? Math.round(
                    (new Date(item.serverTime).getTime() -
                      new Date(item.deviceTime).getTime()) /
                      1000,
                  )
                : 0;
              return (
                <li
                  key={item.id}
                  className={item.voided ? styles.voided : undefined}
                >
                  <span className={styles.logTime}>
                    {formatClock(item.serverTime)}
                    {item.deviceTime && Math.abs(lag) >= 3 ? (
                      <small>pressed {formatClock(item.deviceTime)}</small>
                    ) : null}
                  </span>
                  <span className={styles.logText}>
                    {describeLogItem(item, state.entrants)}
                    <small>
                      #{item.version} · {item.actorName}
                      {item.voided ? " · undone" : ""}
                    </small>
                  </span>
                  {item.type === "SCORE_EVENT" &&
                  !item.voided &&
                  canScore &&
                  state.status === "IN_PROGRESS" ? (
                    <button
                      type="button"
                      className={styles.undo}
                      onClick={() =>
                        sync.enqueue(
                          { type: "VOID", updateId: item.id },
                          `Undo: ${describeLogItem(item, state.entrants)}`,
                        )
                      }
                    >
                      <Undo2 size={15} aria-hidden="true" /> Undo
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
