import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import adminStyles from "@/features/admin/components/admin.module.css";
import styles from "@/features/event/components/settings.module.css";
import { StatusMessages } from "@/features/event/components/status-messages";
import { scoringAdapters } from "@/features/event/domain/event-settings";
import {
  archiveTournamentGameAction,
  updateTournamentGameAction,
} from "@/features/event/server/actions";
import { getTournamentGameDetail } from "@/features/event/server/event-queries";

export const metadata: Metadata = { title: "Game settings" };

export default async function GameSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [game, status] = await Promise.all([
    getTournamentGameDetail(id),
    searchParams,
  ]);
  if (!game || game.status === "ARCHIVED") notFound();

  const taken = game.reservedCount + game.confirmedCount;

  return (
    <div className={adminStyles.content}>
      <Link className={adminStyles.backLink} href="/admin/games">
        <ArrowLeft size={16} aria-hidden="true" /> All games
      </Link>
      <header className={adminStyles.pageHeader}>
        <div>
          <p>{game.tournamentName}</p>
          <h1>{game.name}</h1>
        </div>
      </header>

      <StatusMessages {...status} />

      <dl className={styles.stats}>
        <div>
          <dt>Confirmed</dt>
          <dd>{game.confirmedCount}</dd>
        </div>
        <div>
          <dt>Pending payment review</dt>
          <dd>{game.reservedCount}</dd>
        </div>
        <div>
          <dt>Places left</dt>
          <dd>{Math.max(0, game.capacity - taken)}</dd>
        </div>
      </dl>

      <section className={styles.panel} aria-labelledby="settings-title">
        <div className={styles.panelHeading}>
          <div>
            <p>Registration and scoring</p>
            <h2 id="settings-title">Game settings</h2>
            <span>
              Fee changes apply to new registrations only; submitted
              registrations keep the fee they were quoted.
            </span>
          </div>
        </div>
        <form className={styles.formGrid} action={updateTournamentGameAction}>
          <input type="hidden" name="tournamentGameId" value={game.id} />

          <label className={styles.field}>
            <span>Registration</span>
            <select name="availability" defaultValue={game.availability}>
              <option value="DRAFT">Draft — hidden from participants</option>
              <option value="OPEN">Open — accepting registrations</option>
              <option value="CLOSED">Closed — visible, not accepting</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Display order</span>
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={999}
              defaultValue={game.sortOrder}
            />
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
              defaultValue={game.feeMinor / 100}
            />
          </label>
          <label className={styles.field}>
            <span>Capacity (players)</span>
            <input
              name="capacity"
              type="number"
              inputMode="numeric"
              required
              min={Math.max(1, taken)}
              max={10000}
              step={1}
              defaultValue={game.capacity}
            />
            <small>
              {taken > 0
                ? `Cannot go below ${taken}, the places already taken.`
                : "Maximum number of players."}
            </small>
          </label>
          <label className={styles.field}>
            <span>Scoring</span>
            <select name="scoringAdapter" defaultValue={game.scoringAdapter}>
              {scoringAdapters.map((adapter) => (
                <option key={adapter.key} value={adapter.key}>
                  {adapter.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Progression</span>
            <select name="progressionMode" defaultValue={game.progressionMode}>
              <option value="AUTOMATIC_SINGLE_ELIMINATION">
                Automatic single elimination
              </option>
              <option value="MANUAL">Manual — admin picks who advances</option>
            </select>
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>Short description</span>
            <input
              name="description"
              maxLength={300}
              placeholder="e.g. Classical strategy over the board."
              defaultValue={game.description ?? ""}
            />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>Game rules</span>
            <textarea
              name="rules"
              className={styles.tall}
              maxLength={8000}
              placeholder="Format, time controls, tie-breaks, walkover policy…"
              defaultValue={game.rules ?? ""}
            />
            <small>Published on the public rulebook.</small>
          </label>
          <div className={styles.actions}>
            <button className={styles.primary} type="submit">
              Save game settings
            </button>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="remove-title">
        <div className={styles.panelHeading}>
          <div>
            <p>Lineup</p>
            <h2 id="remove-title">Remove from event</h2>
            <span>
              {game.entryCount > 0
                ? "This game has registrations, so it stays for the record. Set registration to Closed to stop new entries."
                : "Removes the game from this event. It can be added again later."}
            </span>
          </div>
        </div>
        {game.entryCount === 0 ? (
          <form action={archiveTournamentGameAction}>
            <input type="hidden" name="tournamentGameId" value={game.id} />
            <button className={styles.danger} type="submit">
              Remove {game.name}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
