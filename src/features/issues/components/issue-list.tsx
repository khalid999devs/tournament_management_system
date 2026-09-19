import { CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";
import { formatDhakaDateTime } from "@/lib/dates";
import { describeIssueCategory } from "../domain/issues";
import type { IssueItem } from "../server/issues";
import { resolveIssueAction } from "../server/actions";
import styles from "./issues.module.css";

// Shared by the score screen, the operator workspace and the admin list.
// Admins get a resolve form on open reports.
export function IssueList({
  issues,
  resolveReturnTo,
  showMatch = false,
  matchHref,
}: {
  issues: IssueItem[];
  resolveReturnTo?: string;
  showMatch?: boolean;
  matchHref?: (matchId: string) => string;
}) {
  if (issues.length === 0) return null;

  return (
    <ul className={styles.list}>
      {issues.map((issue) => (
        <li key={issue.id} data-status={issue.status}>
          <div className={styles.itemHead}>
            <strong>{describeIssueCategory(issue.category)}</strong>
            <span className={styles.pill} data-status={issue.status}>
              {issue.status === "OPEN" ? (
                <CircleAlert size={14} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={14} aria-hidden="true" />
              )}
              {issue.status === "OPEN" ? "Open" : "Resolved"}
            </span>
          </div>
          <p className={styles.message}>{issue.message}</p>
          <small className={styles.meta}>
            {showMatch ? (
              issue.matchId && issue.matchCode ? (
                matchHref ? (
                  <>
                    <Link href={matchHref(issue.matchId)}>
                      {issue.matchCode}
                    </Link>
                    {" · "}
                  </>
                ) : (
                  `${issue.matchCode} · `
                )
              ) : (
                "General · "
              )
            ) : null}
            {issue.reporterName} · {formatDhakaDateTime(issue.createdAt)}
          </small>
          {issue.status === "RESOLVED" ? (
            <p className={styles.resolution}>
              Resolved
              {issue.resolverName ? ` by ${issue.resolverName}` : ""}
              {issue.resolvedAt
                ? `, ${formatDhakaDateTime(issue.resolvedAt)}`
                : ""}
              {issue.resolutionNote ? `: ${issue.resolutionNote}` : "."}
            </p>
          ) : resolveReturnTo ? (
            <form className={styles.resolve} action={resolveIssueAction}>
              <input type="hidden" name="issueId" value={issue.id} />
              <input type="hidden" name="returnTo" value={resolveReturnTo} />
              <label className="visually-hidden" htmlFor={`note-${issue.id}`}>
                What was done (optional)
              </label>
              <input
                id={`note-${issue.id}`}
                name="note"
                maxLength={1000}
                placeholder="What was done (optional)"
              />
              <button type="submit">Mark resolved</button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
