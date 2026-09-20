"use client";

import { useState, type DragEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import styles from "./game-draw.module.css";

type Player = { code: string; name: string; department: string };

/**
 * Picks between a random draw and a ranking the admin sets themselves.
 * The ranking can be reordered by dragging a row or with the arrow buttons,
 * which are the ones that work on a phone and from the keyboard.
 */
export function SeedingPicker({ players }: { players: Player[] }) {
  const [manual, setManual] = useState(false);
  const [order, setOrder] = useState(players);
  const [held, setHeld] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function drop(event: DragEvent<HTMLLIElement>, to: number) {
    event.preventDefault();
    if (held !== null) move(held, to);
    setHeld(null);
  }

  return (
    <>
      <fieldset className={styles.seeding}>
        <legend>Who plays who</legend>
        <label className={styles.seedOption}>
          <input
            type="radio"
            name="seeding"
            value="RANDOM"
            checked={!manual}
            onChange={() => setManual(false)}
          />
          <span>
            <strong>Random draw</strong>
            <small>
              The computer shuffles everyone. Nobody can guess it or fix it.
            </small>
          </span>
        </label>
        <label className={styles.seedOption}>
          <input
            type="radio"
            name="seeding"
            value="MANUAL"
            checked={manual}
            onChange={() => setManual(true)}
          />
          <span>
            <strong>Manual draw</strong>
            <small>
              You put the players in order. The best two are kept apart until
              the final.
            </small>
          </span>
        </label>
      </fieldset>

      <input
        type="hidden"
        name="manualOrder"
        value={order.map((player) => player.code).join("\n")}
      />

      {!manual || order.length === 0 ? null : (
        <div className={styles.ranking} data-active>
          <p className={styles.rankingHead}>
            Drag a player, or use the arrows. Best player at the top.
          </p>
          <ol className={styles.rankingList}>
            {order.map((player, index) => (
              <li
                key={player.code}
                draggable={manual}
                data-held={held === index || undefined}
                onDragStart={() => setHeld(index)}
                onDragOver={(event) => manual && event.preventDefault()}
                onDrop={(event) => drop(event, index)}
                onDragEnd={() => setHeld(null)}
              >
                <span className={styles.seedNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <GripVertical
                  className={styles.grip}
                  size={16}
                  aria-hidden="true"
                />
                <span className={styles.player}>
                  <strong>{player.name}</strong>
                  <small>
                    {player.department} · {player.code}
                  </small>
                </span>
                <span className={styles.rankButtons}>
                  <button
                    type="button"
                    disabled={!manual || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Move ${player.name} up`}
                  >
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={!manual || index === order.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Move ${player.name} down`}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
