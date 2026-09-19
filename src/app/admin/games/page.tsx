import type { Metadata } from "next";
import Link from "next/link";
import adminStyles from "@/features/admin/components/admin.module.css";
import styles from "@/features/event/components/settings.module.css";
import { StatusMessages } from "@/features/event/components/status-messages";
import {
  scoringAdapters,
  type GameAvailability,
} from "@/features/event/domain/event-settings";
import { addTournamentGameAction } from "@/features/event/server/actions";
import { getEventSetup } from "@/features/event/server/event-queries";
import { formatBdt } from "@/lib/money";

export const metadata: Metadata = { title: "Games" };

const availabilityCopy: Record<
  GameAvailability,
  { label: string; tone?: "good" | "warn" }
> = {
  DRAFT: { label: "Draft" },
  OPEN: { label: "Open", tone: "good" },
  CLOSED: { label: "Closed", tone: "warn" },
};

const suggestedGames = [
  "Chess",
  "Table Tennis",
  "Carrom",
  "Mobile Football",
  "29 Cards",
];

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const [setup, status] = await Promise.all([getEventSetup(), searchParams]);

  return (
    <div className={adminStyles.content}>
      <header className={adminStyles.pageHeader}>
        <div>
          <p>Configuration</p>
          <h1>Games</h1>
          <span>
            Fees, capacity and scoring for each game in{" "}
            {setup?.tournament.name ?? "the event"}.
          </span>
        </div>
      </header>

      <StatusMessages {...status} />

      {!setup ? (
        <div className={styles.empty}>
          <h3>Create the tournament first</h3>
          <p>
            Games belong to a tournament. Set one up under{" "}
            <Link href="/admin/event">Event settings</Link>.
          </p>
        </div>
      ) : (
        <>
          <section className={styles.panel} aria-labelledby="lineup-title">
            <div className={styles.panelHeading}>
              <div>
                <p>Lineup</p>
                <h2 id="lineup-title">Event games</h2>
                <span>
                  New games start as drafts. Open a game to show it on the
                  registration form.
                </span>
              </div>
            </div>
            {setup.games.length === 0 ? (
              <div className={styles.empty}>
                <h3>No games yet</h3>
                <p>Add the first game below.</p>
              </div>
            ) : (
              <div className={styles.table}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Game</th>
                      <th scope="col">Entry fee</th>
                      <th scope="col">Places taken</th>
                      <th scope="col">Scoring</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {setup.games.map((game) => {
                      const taken = game.reservedCount + game.confirmedCount;
                      const availability = availabilityCopy[game.availability];

                      return (
                        <tr key={game.id}>
                          <td>
                            <strong>{game.name}</strong>
                            <small>
                              {game.description ?? "No description"}
                            </small>
                          </td>
                          <td>{formatBdt(game.feeMinor)}</td>
                          <td>
                            <strong>
                              {taken} / {game.capacity}
                            </strong>
                            <small>
                              {game.confirmedCount} confirmed ·{" "}
                              {game.reservedCount} pending
                            </small>
                            <div className={styles.meter} aria-hidden="true">
                              <span
                                style={{
                                  width: `${Math.min(100, (taken / game.capacity) * 100)}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td>
                            {scoringAdapters.find(
                              (adapter) => adapter.key === game.scoringAdapter,
                            )?.label ?? game.scoringAdapter}
                          </td>
                          <td>
                            <span
                              className={styles.pill}
                              data-tone={availability.tone}
                            >
                              {availability.label}
                            </span>
                          </td>
                          <td>
                            <Link
                              href={`/admin/games/${game.id}`}
                              aria-label={`Edit ${game.name}`}
                            >
                              Edit
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="add-title">
            <div className={styles.panelHeading}>
              <div>
                <p>Lineup</p>
                <h2 id="add-title">Add a game</h2>
              </div>
            </div>
            <form className={styles.formGrid} action={addTournamentGameAction}>
              <input
                type="hidden"
                name="tournamentId"
                value={setup.tournament.id}
              />
              <label className={styles.field}>
                <span>Game name</span>
                <input
                  name="name"
                  list="suggested-games"
                  required
                  minLength={2}
                  maxLength={120}
                />
                <datalist id="suggested-games">
                  {suggestedGames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              <label className={styles.field}>
                <span>Scoring</span>
                <select name="scoringAdapter" required>
                  {scoringAdapters.map((adapter) => (
                    <option key={adapter.key} value={adapter.key}>
                      {adapter.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Entry fee (BDT)</span>
                <input
                  name="feeTaka"
                  type="number"
                  inputMode="numeric"
                  required
                  min={0}
                  max={100000}
                  step={1}
                />
              </label>
              <label className={styles.field}>
                <span>Capacity (players)</span>
                <input
                  name="capacity"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={10000}
                  step={1}
                />
              </label>
              <div className={styles.actions}>
                <button className={styles.primary} type="submit">
                  Add game
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
