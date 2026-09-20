"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  accessLevels,
  defaultAccessLevel,
  type AccessLevel,
} from "@/features/operators/domain/access-levels";
import { grantAssignmentAction } from "@/features/operators/server/actions";
import styles from "./operators.module.css";

type Option = { value: string; label: string };
type Player = {
  participantId: string;
  label: string;
  studentId: string;
  registrationCode: string;
  games: string[];
  entries: { id: string; tournamentId: string }[];
};

export type ScopeKind =
  "ALL_TOURNAMENT" | "GAME" | "ROUND" | "MATCH" | "PARTICIPANT_ENTRY";

const kinds: { value: ScopeKind; label: string; hint: string }[] = [
  {
    value: "GAME",
    label: "A whole game",
    hint: "Every match in it, now and later.",
  },
  {
    value: "ALL_TOURNAMENT",
    label: "The whole tournament",
    hint: "Every game and every match.",
  },
  {
    value: "ROUND",
    label: "One round",
    hint: "Only the matches in it.",
  },
  { value: "MATCH", label: "One match", hint: "Only that match." },
  {
    value: "PARTICIPANT_ENTRY",
    label: "Players",
    hint: "Every game a player entered.",
  },
];

export function AssignmentForm({
  operatorId,
  options,
}: {
  operatorId: string;
  options: {
    tournaments: Option[];
    games: Option[];
    rounds: Option[];
    matches: Option[];
  };
}) {
  const [kind, setKind] = useState<ScopeKind>("GAME");
  const [target, setTarget] = useState("");
  const [level, setLevel] = useState<AccessLevel>(defaultAccessLevel);
  const [chosen, setChosen] = useState<Player[]>([]);

  const list =
    kind === "ALL_TOURNAMENT"
      ? options.tournaments
      : kind === "GAME"
        ? options.games
        : kind === "ROUND"
          ? options.rounds
          : kind === "MATCH"
            ? options.matches
            : [];
  const players = kind === "PARTICIPANT_ENTRY";
  const ready = players ? chosen.length > 0 : target !== "";

  function pickKind(next: ScopeKind) {
    setKind(next);
    setTarget("");
  }

  return (
    <form className={styles.assignForm} action={grantAssignmentAction}>
      <input type="hidden" name="operatorId" value={operatorId} />
      {players ? (
        chosen.flatMap((player) =>
          player.entries.map((entry) => (
            <input
              key={entry.id}
              type="hidden"
              name="scope"
              value={`PARTICIPANT_ENTRY|${entry.tournamentId}|${entry.id}`}
            />
          )),
        )
      ) : (
        <input type="hidden" name="scope" value={target} />
      )}

      <fieldset className={styles.step}>
        <legend>
          <span className={styles.stepNumber}>1</span> What they cover
        </legend>
        <div className={styles.kinds}>
          {kinds.map((item) => (
            <label key={item.value} className={styles.kind}>
              <input
                type="radio"
                name="scopeKind"
                value={item.value}
                checked={kind === item.value}
                onChange={() => pickKind(item.value)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.step}>
        <legend>
          <span className={styles.stepNumber}>2</span>{" "}
          {players ? "Which players" : "Which one"}
        </legend>
        {players ? (
          <PlayerPicker chosen={chosen} onChange={setChosen} />
        ) : list.length === 0 ? (
          <p className={styles.stepEmpty}>
            {kind === "ROUND" || kind === "MATCH"
              ? "Rounds and matches appear here once you make the draw for a game."
              : "Add a game to the tournament first."}
          </p>
        ) : (
          <label className={styles.targetField}>
            <span className="visually-hidden">Target</span>
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="" disabled>
                Choose one
              </option>
              {list.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      <fieldset className={styles.step}>
        <legend>
          <span className={styles.stepNumber}>3</span> What they can do
        </legend>
        <div className={styles.levels}>
          {accessLevels.map((item) => (
            <label key={item.value} className={styles.level}>
              <input
                type="radio"
                name="accessLevel"
                value={item.value}
                checked={level === item.value}
                onChange={() => setLevel(item.value)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.assignActions}>
        <button type="submit" disabled={!ready}>
          {players && chosen.length > 1
            ? `Give access to ${chosen.length} players`
            : "Give access"}
        </button>
      </div>
    </form>
  );
}

/**
 * Searches players only once an admin asks for them. An event can hold
 * hundreds, so none of them are shipped with the page.
 */
function PlayerPicker({
  chosen,
  onChange,
}: {
  chosen: Player[];
  onChange: (players: Player[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[] | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const ticket = (request.current += 1);
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `/staff/api/participants?q=${encodeURIComponent(query)}`,
          );
          const body = (await response.json()) as { entries?: Player[] };
          if (ticket === request.current) setResults(body.entries ?? []);
        } catch {
          if (ticket === request.current) setResults([]);
        } finally {
          if (ticket === request.current) setLoading(false);
        }
      },
      query === "" ? 0 : 250,
    );
    return () => clearTimeout(timer);
  }, [query]);

  function toggle(player: Player) {
    onChange(
      chosen.some((item) => item.participantId === player.participantId)
        ? chosen.filter((item) => item.participantId !== player.participantId)
        : [...chosen, player],
    );
  }

  return (
    <div className={styles.playerPicker}>
      <label className={styles.playerSearch}>
        <span className="visually-hidden">Search players</span>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Name, student ID or code"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {chosen.length > 0 ? (
        <ul className={styles.chosen} aria-label="Chosen players">
          {chosen.map((player) => (
            <li key={player.participantId}>
              {player.label}
              <button
                type="button"
                onClick={() => toggle(player)}
                aria-label={`Remove ${player.label}`}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.playerResults} aria-busy={loading || undefined}>
        {results === null ? (
          <p className={styles.stepEmpty}>Loading players…</p>
        ) : results.length === 0 ? (
          <p className={styles.stepEmpty}>
            {query ? "No player matches that." : "No confirmed players yet."}
          </p>
        ) : (
          <ul>
            {results.map((player) => {
              const picked = chosen.some(
                (item) => item.participantId === player.participantId,
              );
              return (
                <li key={player.participantId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggle(player)}
                    />
                    <span>
                      <strong>{player.label}</strong>
                      <small>
                        {player.games.join(", ")} · {player.studentId}
                      </small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className={styles.pickerNote}>
        Choosing a player covers every game they entered. Showing the first 40;
        search to narrow it.
      </p>
    </div>
  );
}
