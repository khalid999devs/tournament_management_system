"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { AnyScoringAdapter } from "@/features/scoring/adapters";
import { setsScoring } from "@/features/scoring/adapters/sets";
import { carromScoring } from "@/features/scoring/adapters/carrom-points";
import { placementScoring } from "@/features/scoring/adapters/placement-points";
import type { ScoringContext } from "@/features/scoring/domain/types";
import type { MatchEntrant } from "../server/match-queries";
import { seatName } from "./describe";
import styles from "./score-console.module.css";

/* eslint-disable @typescript-eslint/no-explicit-any -- each panel reads its own adapter's score shape */

export type PanelProps = {
  adapter: AnyScoringAdapter;
  context: ScoringContext<any>;
  score: any;
  entrants: MatchEntrant[];
  disabled: boolean;
  emit: (event: Record<string, unknown>, label: string) => void;
  setScore: (score: unknown, label: string) => void;
  finalizeWith: (score: unknown, label: string) => void;
  canFinalize: boolean;
  busy: boolean;
};

function SeatLabel({
  entrants,
  seat,
}: {
  entrants: MatchEntrant[];
  seat: number;
}) {
  const entrant = entrants.find((item) => item.seat === seat);
  return (
    <span className={styles.seatLabel}>
      <strong>{entrant?.name ?? `Seat ${seat}`}</strong>
      {entrant ? <small>{entrant.registrationCode}</small> : null}
    </span>
  );
}

function Scoreboard({
  entrants,
  seats,
  values,
  caption,
}: {
  entrants: MatchEntrant[];
  seats: number[];
  values: (string | number)[];
  caption?: string;
}) {
  return (
    <div className={styles.scoreboard}>
      {seats.map((seat, index) => (
        <div key={seat} className={styles.scoreSide}>
          <SeatLabel entrants={entrants} seat={seat} />
          <output aria-label={`${seatName(entrants, seat)} score`}>
            {values[index]}
          </output>
        </div>
      ))}
      {caption ? <p className={styles.scoreCaption}>{caption}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ChessPanel({
  context,
  entrants,
  disabled,
  finalizeWith,
  canFinalize,
  busy,
  adapter,
}: PanelProps) {
  const [first, second] = context.seats;
  const [choice, setChoice] = useState<"1" | "2" | "DRAW" | null>(null);
  const [tiebreak, setTiebreak] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const needsTiebreak = context.requiresWinner || !context.config.allowDraws;

  const draft =
    choice === null
      ? null
      : {
          winnerSeat:
            choice === "DRAW" ? null : choice === "1" ? first : second,
          draw: choice === "DRAW",
          tiebreakWinnerSeat: choice === "DRAW" ? tiebreak : null,
          note: note.trim() || null,
        };

  let preview: string | null = null;
  let problem: string | null = null;
  if (draft) {
    try {
      preview = adapter.finalize(draft, context).displayScore;
    } catch (error) {
      problem = (error as Error).message;
    }
  }

  return (
    <div className={styles.panelBody}>
      <p className={styles.hint}>
        Pick the outcome, check it, then confirm. This records the final result.
      </p>
      <div className={styles.choiceRow} role="radiogroup" aria-label="Outcome">
        {[
          { value: "1" as const, label: `${seatName(entrants, first)} won` },
          { value: "DRAW" as const, label: "Draw" },
          { value: "2" as const, label: `${seatName(entrants, second)} won` },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            className={
              choice === option.value ? styles.choiceActive : styles.choice
            }
            disabled={disabled || !canFinalize}
            onClick={() => setChoice(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {choice === "DRAW" ? (
        <fieldset className={styles.inlineFieldset}>
          <legend>
            {needsTiebreak
              ? "Tie-break winner (required)"
              : "Tie-break winner (optional)"}
          </legend>
          {[first, second].map((seat) => (
            <label key={seat} className={styles.radio}>
              <input
                type="radio"
                name="tiebreak"
                checked={tiebreak === seat}
                onChange={() => setTiebreak(seat)}
              />
              {seatName(entrants, seat)}
            </label>
          ))}
          {!needsTiebreak ? (
            <label className={styles.radio}>
              <input
                type="radio"
                name="tiebreak"
                checked={tiebreak === null}
                onChange={() => setTiebreak(null)}
              />
              No tie-break, the draw stands
            </label>
          ) : null}
        </fieldset>
      ) : null}

      <label className={styles.field}>
        <span>Note (optional)</span>
        <input
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. won on time"
        />
      </label>

      {problem ? <p className={styles.problem}>{problem}</p> : null}
      {!canFinalize ? (
        <p className={styles.hint}>
          Your assignment does not include confirming results.
        </p>
      ) : null}
      <button
        type="button"
        className={styles.primary}
        disabled={
          disabled || busy || !canFinalize || !draft || Boolean(problem)
        }
        onClick={() =>
          draft && preview && finalizeWith(draft, `Final result ${preview}`)
        }
      >
        {preview ? `Confirm result ${preview}` : "Confirm result"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function pairInput(value: string) {
  const match = value.trim().match(/^(\d{1,3})\s*[-–:]\s*(\d{1,3})$/);
  return match
    ? ([Number(match[1]), Number(match[2])] as [number, number])
    : null;
}

export function GoalsPanel({
  context,
  score,
  entrants,
  disabled,
  emit,
  setScore,
  busy,
}: PanelProps) {
  const [first, second] = context.seats;
  const [phase, setPhase] = useState<"REGULAR" | "EXTRA_TIME" | "PENALTIES">(
    score.penalties ? "PENALTIES" : score.extraTime ? "EXTRA_TIME" : "REGULAR",
  );
  const total = [
    score.regular[0] + (score.extraTime?.[0] ?? 0),
    score.regular[1] + (score.extraTime?.[1] ?? 0),
  ];
  const phases = [
    { value: "REGULAR" as const, label: "Regular time" },
    ...(context.config.extraTime
      ? [{ value: "EXTRA_TIME" as const, label: "Extra time" }]
      : []),
    ...(context.config.penalties
      ? [{ value: "PENALTIES" as const, label: "Penalties" }]
      : []),
  ];

  const [typed, setTyped] = useState({
    regular: "",
    extraTime: "",
    penalties: "",
  });
  const submitTyped = () => {
    const regular = pairInput(typed.regular);
    if (!regular) return;
    setScore(
      {
        regular,
        extraTime: typed.extraTime ? pairInput(typed.extraTime) : null,
        penalties: typed.penalties ? pairInput(typed.penalties) : null,
      },
      `Typed score ${typed.regular}`,
    );
    setTyped({ regular: "", extraTime: "", penalties: "" });
  };

  return (
    <div className={styles.panelBody}>
      <Scoreboard
        entrants={entrants}
        seats={context.seats}
        values={total}
        caption={
          [
            score.extraTime
              ? `Extra time ${score.extraTime[0]}–${score.extraTime[1]}`
              : null,
            score.penalties
              ? `Penalties ${score.penalties[0]}–${score.penalties[1]}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
      {phases.length > 1 ? (
        <div className={styles.segmented} role="radiogroup" aria-label="Period">
          {phases.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={phase === item.value}
              className={
                phase === item.value ? styles.segmentActive : styles.segment
              }
              onClick={() => setPhase(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.bigButtons}>
        {[first, second].map((seat) => (
          <button
            key={seat}
            type="button"
            className={styles.bigButton}
            disabled={disabled}
            onClick={() =>
              emit(
                { type: "GOAL", seat, phase },
                `Goal: ${seatName(entrants, seat)}`,
              )
            }
          >
            <Plus size={22} aria-hidden="true" />
            {phase === "PENALTIES" ? "Penalty scored" : "Goal"}
            <small>{seatName(entrants, seat)}</small>
          </button>
        ))}
      </div>
      <details className={styles.disclosure}>
        <summary>Type the full score instead</summary>
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Regular time</span>
            <input
              value={typed.regular}
              inputMode="numeric"
              placeholder="2-1"
              onChange={(event) =>
                setTyped({ ...typed, regular: event.target.value })
              }
            />
          </label>
          {context.config.extraTime ? (
            <label className={styles.field}>
              <span>Extra time goals</span>
              <input
                value={typed.extraTime}
                inputMode="numeric"
                placeholder="optional, e.g. 1-0"
                onChange={(event) =>
                  setTyped({ ...typed, extraTime: event.target.value })
                }
              />
            </label>
          ) : null}
          {context.config.penalties ? (
            <label className={styles.field}>
              <span>Penalties</span>
              <input
                value={typed.penalties}
                inputMode="numeric"
                placeholder="optional, e.g. 4-3"
                onChange={(event) =>
                  setTyped({ ...typed, penalties: event.target.value })
                }
              />
            </label>
          ) : null}
        </div>
        <p className={styles.hint}>
          Scores are {seatName(entrants, first)} first. Replaces the live count;
          only works if no one changed the score since you opened it.
        </p>
        <button
          type="button"
          className={styles.secondary}
          disabled={disabled || busy || !pairInput(typed.regular)}
          onClick={submitTyped}
        >
          Save typed score
        </button>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function SetsPanel({
  context,
  score,
  entrants,
  disabled,
  emit,
  setScore,
  busy,
}: PanelProps) {
  const [first, second] = context.seats;
  const decided = setsScoring.isDecided(score, context.config);
  const current = setsScoring.currentSet(score, context.config);
  const won = setsScoring.setsWon(score, context.config);
  const running = score.sets[current - 1] ?? [0, 0];
  const [setInput, setSetInput] = useState("");
  const [allSets, setAllSets] = useState("");

  const parsedAll = allSets
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(pairInput);
  const allValid = parsedAll.length > 0 && parsedAll.every(Boolean);

  return (
    <div className={styles.panelBody}>
      <Scoreboard
        entrants={entrants}
        seats={context.seats}
        values={decided ? won : running}
        caption={
          decided
            ? `Sets won · best of ${context.config.bestOf}`
            : `Set ${current} points · sets ${won[0]}–${won[1]} · best of ${context.config.bestOf}`
        }
      />
      <ol className={styles.setList} aria-label="Set scores">
        {score.sets.map((pair: [number, number], index: number) => (
          <li
            key={index}
            className={
              index === current - 1 && !decided ? styles.setCurrent : undefined
            }
          >
            <span>Set {index + 1}</span>
            <strong>
              {pair[0]}–{pair[1]}
            </strong>
          </li>
        ))}
      </ol>
      {decided ? (
        <p className={styles.hint}>
          The match is decided. Confirm the result below.
        </p>
      ) : (
        <>
          <p className={styles.setHeading}>
            Set {current}:{" "}
            <strong>
              {running[0]}–{running[1]}
            </strong>
          </p>
          <div className={styles.bigButtons}>
            {[first, second].map((seat) => (
              <button
                key={seat}
                type="button"
                className={styles.bigButton}
                disabled={disabled}
                onClick={() =>
                  emit(
                    { type: "POINT", seat, set: current },
                    `Point: ${seatName(entrants, seat)}`,
                  )
                }
              >
                <Plus size={22} aria-hidden="true" />
                Point
                <small>{seatName(entrants, seat)}</small>
              </button>
            ))}
          </div>
          <details className={styles.disclosure}>
            <summary>Enter set {current} as a finished score</summary>
            <div className={styles.inlineForm}>
              <label className={styles.field}>
                <span>
                  Set {current} ({seatName(entrants, first)} first)
                </span>
                <input
                  value={setInput}
                  inputMode="numeric"
                  placeholder="11-7"
                  onChange={(event) => setSetInput(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={styles.secondary}
                disabled={
                  disabled ||
                  !pairInput(setInput) ||
                  running[0] + running[1] > 0
                }
                onClick={() => {
                  const points = pairInput(setInput);
                  if (!points) return;
                  emit(
                    { type: "SET", set: current, points },
                    `Set ${current} ${points[0]}–${points[1]}`,
                  );
                  setSetInput("");
                }}
              >
                Save set
              </button>
            </div>
          </details>
        </>
      )}
      <details className={styles.disclosure}>
        <summary>Correct all set scores</summary>
        <label className={styles.field}>
          <span>Every set, in order ({seatName(entrants, first)} first)</span>
          <input
            value={allSets}
            placeholder="11-7, 9-11, 11-5"
            onChange={(event) => setAllSets(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={styles.secondary}
          disabled={disabled || busy || !allValid}
          onClick={() => {
            setScore({ sets: parsedAll }, `Typed sets ${allSets}`);
            setAllSets("");
          }}
        >
          Replace set scores
        </button>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function CarromPanel({
  context,
  score,
  entrants,
  disabled,
  emit,
}: PanelProps) {
  const totals = carromScoring.totals(score, context.seats);
  const over = carromScoring.isOver(score, context);
  const [seat, setSeat] = useState<number>(context.seats[0]);
  const [points, setPoints] = useState(1);
  const max = context.config.maxPointsPerBoard;
  const target = [
    context.config.targetPoints
      ? `first to ${context.config.targetPoints}`
      : null,
    context.config.maxBoards ? `${context.config.maxBoards} boards` : null,
  ]
    .filter(Boolean)
    .join(" or ");

  return (
    <div className={styles.panelBody}>
      <Scoreboard
        entrants={entrants}
        seats={context.seats}
        values={totals}
        caption={`${score.boards.length} boards · ${target}`}
      />
      {over ? (
        <p className={styles.hint}>
          The match is won. Confirm the result below.
        </p>
      ) : (
        <div className={styles.boardForm}>
          <fieldset className={styles.inlineFieldset}>
            <legend>Board {score.boards.length + 1} won by</legend>
            {context.seats.map((item) => (
              <label key={item} className={styles.radio}>
                <input
                  type="radio"
                  name="board-winner"
                  checked={seat === item}
                  onChange={() => setSeat(item)}
                />
                {seatName(entrants, item)}
              </label>
            ))}
          </fieldset>
          <div className={styles.stepper}>
            <button
              type="button"
              aria-label="Fewer points"
              onClick={() => setPoints(Math.max(0, points - 1))}
            >
              <Minus size={18} aria-hidden="true" />
            </button>
            <label>
              <span className="visually-hidden">Points</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={max}
                value={points}
                onChange={(event) =>
                  setPoints(
                    Math.max(0, Math.min(max, Number(event.target.value) || 0)),
                  )
                }
              />
            </label>
            <button
              type="button"
              aria-label="More points"
              onClick={() => setPoints(Math.min(max, points + 1))}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className={styles.primary}
            disabled={disabled}
            onClick={() =>
              emit(
                { type: "BOARD", seat, points },
                `Board: ${seatName(entrants, seat)} +${points}`,
              )
            }
          >
            Record board
          </button>
        </div>
      )}
      {score.boards.length ? (
        <ol className={styles.setList} aria-label="Boards">
          {score.boards.map(
            (board: { seat: number; points: number }, index: number) => (
              <li key={index}>
                <span>Board {index + 1}</span>
                <strong>
                  {seatName(entrants, board.seat)} +{board.points}
                </strong>
              </li>
            ),
          )}
        </ol>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TiebreakEditor({
  seats,
  value,
  higherIsBetter,
  order,
  entrants,
  disabled,
  emit,
}: {
  seats: number[];
  value: (seat: number) => number | null;
  higherIsBetter: boolean;
  order: number[] | null;
  entrants: MatchEntrant[];
  disabled: boolean;
  emit: PanelProps["emit"];
}) {
  const known = seats.filter((seat) => value(seat) !== null);
  const values = known.map((seat) => value(seat));
  const hasTie = new Set(values).size !== values.length;
  const ranked = [...known].sort((a, b) => {
    const diff = higherIsBetter ? value(b)! - value(a)! : value(a)! - value(b)!;
    if (diff) return diff;
    const ia = order?.indexOf(a) ?? -1;
    const ib = order?.indexOf(b) ?? -1;
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a - b;
  });
  const [draft, setDraft] = useState<number[] | null>(null);
  const list = draft ?? ranked;

  if (!hasTie && !order) return null;

  const move = (index: number, direction: -1 | 1) => {
    const next = [...list];
    const target = index + direction;
    if (
      target < 0 ||
      target >= next.length ||
      value(next[index]) !== value(next[target])
    )
      return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  return (
    <details className={styles.disclosure} open={hasTie}>
      <summary>Tie-break order{hasTie ? " (needed)" : ""}</summary>
      <p className={styles.hint}>
        Players with equal totals can be reordered. Top of the list places
        higher.
      </p>
      <ol className={styles.rankList}>
        {list.map((seat, index) => (
          <li key={seat}>
            <span>
              {seatName(entrants, seat)} <small>{value(seat)}</small>
            </span>
            <span>
              <button
                type="button"
                aria-label="Move up"
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={styles.secondary}
        disabled={disabled}
        onClick={() => {
          emit(
            { type: "TIEBREAK", order: list, previous: order },
            "Tie-break order",
          );
          setDraft(null);
        }}
      >
        Save tie-break order
      </button>
    </details>
  );
}

export function MultiplayerPanel({
  context,
  score,
  entrants,
  disabled,
  emit,
}: PanelProps) {
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const total = (seat: number) => score.points[String(seat)] ?? 0;
  const parsed = Object.fromEntries(
    Object.entries(deltas)
      .filter(
        ([, value]) => value.trim() !== "" && /^-?\d+$/.test(value.trim()),
      )
      .map(([seat, value]) => [seat, Number(value)]),
  );
  const ready = Object.values(parsed).some((value) => value !== 0);

  return (
    <div className={styles.panelBody}>
      <table className={styles.pointsTable}>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Total</th>
            <th scope="col">This hand</th>
          </tr>
        </thead>
        <tbody>
          {context.seats.map((seat) => (
            <tr key={seat}>
              <td>
                <SeatLabel entrants={entrants} seat={seat} />
              </td>
              <td className={styles.total}>{total(seat)}</td>
              <td>
                <input
                  aria-label={`Points this hand for ${seatName(entrants, seat)}`}
                  inputMode="numeric"
                  value={deltas[String(seat)] ?? ""}
                  placeholder="0"
                  onChange={(event) =>
                    setDeltas({ ...deltas, [String(seat)]: event.target.value })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.hint}>
        {score.hands} hands recorded
        {context.config.targetPoints
          ? ` · game ends at ${context.config.targetPoints}`
          : ""}{" "}
        · {context.config.higherWins ? "highest" : "lowest"} total wins. Use a
        minus sign for penalties.
      </p>
      <button
        type="button"
        className={styles.primary}
        disabled={disabled || !ready}
        onClick={() => {
          emit({ type: "HAND", deltas: parsed }, `Hand ${score.hands + 1}`);
          setDeltas({});
        }}
      >
        Record hand
      </button>
      <TiebreakEditor
        seats={context.seats}
        value={total}
        higherIsBetter={context.config.higherWins}
        order={score.tiebreakOrder}
        entrants={entrants}
        disabled={disabled}
        emit={emit}
      />
    </div>
  );
}

export function ScoreComparePanel({
  context,
  score,
  entrants,
  disabled,
  emit,
}: PanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const read = (seat: number): number | null =>
    score.values[String(seat)] ?? null;
  const step = context.config.decimals ? 1 / 10 ** context.config.decimals : 1;

  return (
    <div className={styles.panelBody}>
      <p className={styles.hint}>
        {context.config.direction === "HIGHER" ? "Highest" : "Lowest"} value
        wins · unit: {context.config.unit || "none"}
      </p>
      <ul className={styles.valueList}>
        {context.seats.map((seat) => {
          const draft = drafts[String(seat)] ?? "";
          const number = draft.trim() === "" ? null : Number(draft);
          const valid = number !== null && Number.isFinite(number);
          return (
            <li key={seat}>
              <SeatLabel entrants={entrants} seat={seat} />
              <output>{read(seat) ?? "Not entered"}</output>
              <input
                aria-label={`New value for ${seatName(entrants, seat)}`}
                inputMode="decimal"
                type="number"
                step={step}
                value={draft}
                onChange={(event) =>
                  setDrafts({ ...drafts, [String(seat)]: event.target.value })
                }
              />
              <button
                type="button"
                className={styles.secondary}
                disabled={disabled || !valid}
                onClick={() => {
                  emit(
                    {
                      type: "VALUE",
                      seat,
                      value: number,
                      previous: read(seat),
                    },
                    `${seatName(entrants, seat)}: ${draft}`,
                  );
                  setDrafts({ ...drafts, [String(seat)]: "" });
                }}
              >
                Save
              </button>
            </li>
          );
        })}
      </ul>
      <TiebreakEditor
        seats={context.seats}
        value={read}
        higherIsBetter={context.config.direction === "HIGHER"}
        order={score.tiebreakOrder}
        entrants={entrants}
        disabled={disabled}
        emit={emit}
      />
    </div>
  );
}

export function PlacementPanel({
  context,
  score,
  entrants,
  disabled,
  emit,
}: PanelProps) {
  const positions = Array.from(
    { length: context.seats.length },
    (_, index) => index + 1,
  );

  return (
    <div className={styles.panelBody}>
      <table className={styles.pointsTable}>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Finish</th>
            <th scope="col">Elims</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {context.seats.map((seat) => {
            const row = placementScoring.rowFor(score, seat);
            return (
              <tr key={seat}>
                <td>
                  <SeatLabel entrants={entrants} seat={seat} />
                </td>
                <td>
                  <select
                    aria-label={`Finishing position for ${seatName(entrants, seat)}`}
                    value={row.finish ?? ""}
                    disabled={disabled}
                    onChange={(event) => {
                      const finish = event.target.value
                        ? Number(event.target.value)
                        : null;
                      emit(
                        { type: "FINISH", seat, finish, previous: row.finish },
                        `${seatName(entrants, seat)} finished #${finish ?? "?"}`,
                      );
                    }}
                  >
                    <option value="">Not set</option>
                    {positions.map((position) => (
                      <option key={position} value={position}>
                        #{position}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.killButton}
                    disabled={disabled}
                    onClick={() =>
                      emit(
                        { type: "KILL", seat },
                        `Elimination: ${seatName(entrants, seat)}`,
                      )
                    }
                  >
                    {row.kills} <Plus size={14} aria-label="Add elimination" />
                  </button>
                </td>
                <td className={styles.total}>
                  {placementScoring.pointsFor(row, context.config)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const panels: Record<string, (props: PanelProps) => React.ReactNode> = {
  CHESS_OUTCOME: ChessPanel,
  GOALS: GoalsPanel,
  SETS: SetsPanel,
  CARROM_POINTS: CarromPanel,
  MULTIPLAYER_POINTS: MultiplayerPanel,
  SCORE_COMPARE: ScoreComparePanel,
  PLACEMENT_POINTS: PlacementPanel,
};
