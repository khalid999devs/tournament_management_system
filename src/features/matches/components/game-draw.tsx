import Link from "next/link";
import styles from "@/features/event/components/settings.module.css";
import { formatDhakaDateTime } from "@/lib/dates";
import { describeStatus } from "../domain/commands";
import {
  addManualMatchAction,
  addRoundAction,
  deleteManualMatchAction,
  generateBracketAction,
  resetBracketAction,
} from "../server/actions";
import type { getGameBracket } from "../server/admin-match-queries";
import draw from "./game-draw.module.css";

type Bracket = Awaited<ReturnType<typeof getGameBracket>>;

export function GameDraw({
  game,
  bracket,
}: {
  game: { id: string; progressionMode: string; registrationOpen: boolean };
  bracket: Bracket;
}) {
  const knockout = game.progressionMode === "AUTOMATIC_SINGLE_ELIMINATION";
  const hasRounds = bracket.rounds.length > 0;
  const blockers = [
    game.registrationOpen
      ? "Registration for this game is still open. Set it to Closed above."
      : null,
    bracket.pendingCount > 0
      ? `${bracket.pendingCount} registration${bracket.pendingCount === 1 ? " is" : "s are"} awaiting payment review.`
      : null,
    bracket.confirmed.length < 2
      ? "At least two confirmed players are needed."
      : null,
  ].filter(Boolean);

  return (
    <section id="draw" className={styles.panel} aria-labelledby="draw-title">
      <div className={styles.panelHeading}>
        <div>
          <p>{knockout ? "Knockout" : "Manual rounds"}</p>
          <h2 id="draw-title">
            {knockout ? "Draw and bracket" : "Rounds and matches"}
          </h2>
          <span>
            {bracket.confirmed.length} confirmed{" "}
            {bracket.confirmed.length === 1 ? "player" : "players"}.{" "}
            {knockout
              ? "The draw uses confirmed players only. Top seeds get byes when the field is not a power of two, and winners move on automatically."
              : "Create each round and choose who plays in each match. Results are recorded, and you decide who plays next."}
          </span>
        </div>
      </div>

      {knockout && !hasRounds ? (
        <>
          {blockers.length ? (
            <ul className={draw.blockers}>
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}
          <form action={generateBracketAction} className={styles.stack}>
            <input type="hidden" name="tournamentGameId" value={game.id} />
            <fieldset className={draw.seeding}>
              <legend>Seeding</legend>
              <label className={styles.check}>
                <input
                  type="radio"
                  name="seeding"
                  value="RANDOM"
                  defaultChecked
                />{" "}
                Random draw (secure shuffle)
              </label>
              <label className={styles.check}>
                <input type="radio" name="seeding" value="MANUAL" /> Manual
                order: list below, top seed first
              </label>
            </fieldset>
            <label className={styles.field}>
              <span>Manual seeding (registration codes, one per line)</span>
              <textarea
                name="manualOrder"
                defaultValue={bracket.confirmed
                  .map((entry) => entry.code)
                  .join("\n")}
              />
              <small>
                Used only with manual order. Every confirmed player must appear
                exactly once.
              </small>
            </label>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                type="submit"
                disabled={blockers.length > 0}
              >
                Make the draw
              </button>
            </div>
          </form>
        </>
      ) : null}

      {!knockout ? (
        <form action={addRoundAction} className={draw.inlineForm}>
          <input type="hidden" name="tournamentGameId" value={game.id} />
          <label className={styles.field}>
            <span>New round</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder={`Round ${bracket.rounds.length + 1}`}
            />
          </label>
          <button className={styles.secondary} type="submit">
            Add round
          </button>
        </form>
      ) : null}

      {hasRounds ? (
        <div className={knockout ? draw.bracket : draw.roundList}>
          {bracket.rounds.map((round) => (
            <div key={round.id} className={draw.round}>
              <h3>
                {round.name} <small>{round.status.toLowerCase()}</small>
              </h3>
              {round.matches.length === 0 ? (
                <p className={draw.muted}>No matches yet.</p>
              ) : null}
              {round.matches.map((match) => (
                <article key={match.id} className={draw.match}>
                  <Link href={`/admin/matches/${match.id}`}>
                    <header>
                      <strong>{match.code}</strong>
                      <span data-status={match.status}>
                        {describeStatus(match.status)}
                      </span>
                    </header>
                    <ul>
                      {match.entrants.length === 0 ? (
                        <li className={draw.muted}>Awaiting winners</li>
                      ) : null}
                      {match.entrants.map((entrant) => (
                        <li
                          key={entrant.seat}
                          data-winner={entrant.placement === 1 || undefined}
                        >
                          {entrant.name}
                        </li>
                      ))}
                      {knockout &&
                      match.entrants.length === 1 &&
                      match.status === "SCHEDULED" ? (
                        <li className={draw.muted}>Awaiting opponent</li>
                      ) : null}
                    </ul>
                    <footer>
                      {match.displayScore ??
                        (match.scheduledAt
                          ? formatDhakaDateTime(match.scheduledAt)
                          : (match.station ?? "Not scheduled"))}
                    </footer>
                  </Link>
                  {!knockout &&
                  !match.startedAt &&
                  match.status === "SCHEDULED" ? (
                    <form action={deleteManualMatchAction}>
                      <input
                        type="hidden"
                        name="tournamentGameId"
                        value={game.id}
                      />
                      <input type="hidden" name="matchId" value={match.id} />
                      <button type="submit" className={draw.linkButton}>
                        Delete
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}

              {!knockout ? (
                <details className={draw.addMatch}>
                  <summary>Add a match to {round.name}</summary>
                  <form action={addManualMatchAction} className={styles.stack}>
                    <input
                      type="hidden"
                      name="tournamentGameId"
                      value={game.id}
                    />
                    <input type="hidden" name="roundId" value={round.id} />
                    <fieldset className={draw.players}>
                      <legend>Players</legend>
                      {bracket.confirmed.map((entry) => (
                        <label key={entry.id} className={styles.check}>
                          <input
                            type="checkbox"
                            name="entryId"
                            value={entry.id}
                          />
                          <span>
                            {entry.name} <small>{entry.code}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <label className={styles.field}>
                      <span>Start time (optional)</span>
                      <input type="datetime-local" name="scheduledAt" />
                    </label>
                    <label className={styles.field}>
                      <span>Table or station (optional)</span>
                      <input name="station" maxLength={80} />
                    </label>
                    <button className={styles.primary} type="submit">
                      Create match
                    </button>
                  </form>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {knockout && hasRounds && !bracket.lock.started ? (
        <details className={draw.reset}>
          <summary>Reset the draw</summary>
          <form action={resetBracketAction} className={draw.inlineForm}>
            <input type="hidden" name="tournamentGameId" value={game.id} />
            <label className={styles.field}>
              <span>Type RESET to remove every match in this draw</span>
              <input
                name="confirm"
                required
                pattern="RESET"
                autoComplete="off"
              />
            </label>
            <button className={styles.danger} type="submit">
              Remove draw
            </button>
          </form>
        </details>
      ) : null}
    </section>
  );
}
