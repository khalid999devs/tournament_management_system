"use client";

import { useState } from "react";
import styles from "@/features/event/components/settings.module.css";
import { updateScoringRulesAction } from "@/features/matches/server/actions";
import { getScoringAdapter, scoringAdapterList } from "../adapters";
import { configFieldValue } from "../domain/config-form";

export function ScoringRulesForm({
  tournamentGameId,
  adapterKey,
  progressionMode,
  config,
  lock,
}: {
  tournamentGameId: string;
  adapterKey: string;
  progressionMode: string;
  config: Record<string, unknown>;
  lock: { hasRounds: boolean; started: boolean };
}) {
  const [selected, setSelected] = useState(adapterKey);
  const adapter = getScoringAdapter(selected);
  const same = selected === adapterKey;
  const values = same
    ? config
    : (adapter.configSchema.parse({}) as Record<string, unknown>);
  const formatLocked = lock.hasRounds || lock.started;

  return (
    <form className={styles.formGrid} action={updateScoringRulesAction}>
      <input type="hidden" name="tournamentGameId" value={tournamentGameId} />
      <input type="hidden" name="configFor" value={selected} />

      <label className={`${styles.field} ${styles.wide}`}>
        <span>Scoring type</span>
        <select
          name="scoringAdapter"
          value={selected}
          disabled={formatLocked}
          onChange={(event) => setSelected(event.target.value)}
        >
          {scoringAdapterList.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}: {item.examples}
            </option>
          ))}
        </select>
        {formatLocked ? (
          <input type="hidden" name="scoringAdapter" value={selected} />
        ) : null}
        <small>{adapter.summary}</small>
      </label>

      <label className={`${styles.field} ${styles.wide}`}>
        <span>Progression</span>
        <select
          name="progressionMode"
          defaultValue={progressionMode}
          disabled={formatLocked}
        >
          <option value="AUTOMATIC_SINGLE_ELIMINATION">Knockout</option>
          <option value="MANUAL">Manual rounds</option>
        </select>
        {formatLocked ? (
          <input type="hidden" name="progressionMode" value={progressionMode} />
        ) : null}
        <small>
          {formatLocked
            ? "Scoring type and progression are fixed while a draw exists."
            : `One draw builds the whole bracket. Suggested here: ${
                adapter.defaultProgression === "MANUAL" ? "manual" : "knockout"
              }.`}
        </small>
      </label>

      {!same ? (
        <p className={`${styles.sectionLabel}`}>
          Save to switch to {adapter.label}; its own settings then appear here
          with sensible defaults.
        </p>
      ) : (
        adapter.configFields.map((field) => {
          const name = `config.${field.name}`;
          const value = values[field.name];
          const key = `${selected}-${field.name}`;
          if (field.kind === "boolean") {
            return (
              <label key={key} className={`${styles.check} ${styles.wide}`}>
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={Boolean(value)}
                  disabled={lock.started}
                />
                <span>
                  {field.label}
                  {field.help ? (
                    <small className={styles.checkHelp}>{field.help}</small>
                  ) : null}
                </span>
              </label>
            );
          }
          return (
            <label key={key} className={styles.field}>
              <span>{field.label}</span>
              {field.kind === "select" ? (
                <select
                  name={name}
                  defaultValue={configFieldValue(value)}
                  disabled={lock.started}
                >
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.kind === "number" ? (
                <input
                  name={name}
                  type="number"
                  inputMode="numeric"
                  min={field.min}
                  max={field.max}
                  required={!field.optional}
                  defaultValue={configFieldValue(value)}
                  disabled={lock.started}
                />
              ) : field.kind === "numberList" ? (
                <input
                  name={name}
                  defaultValue={configFieldValue(value)}
                  disabled={lock.started}
                />
              ) : (
                <input
                  name={name}
                  maxLength={field.maxLength}
                  defaultValue={configFieldValue(value)}
                  disabled={lock.started}
                />
              )}
              {field.help ? <small>{field.help}</small> : null}
            </label>
          );
        })
      )}

      <div className={styles.actions}>
        <button
          className={styles.primary}
          type="submit"
          disabled={lock.started}
        >
          Save scoring rules
        </button>
      </div>
    </form>
  );
}
