"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { getRemainingCapacity } from "@/features/registration/domain/quote";
import {
  createRegistrationDetailsSchema,
  type RegistrationDetails,
} from "@/features/registration/domain/schemas";
import type { RegistrationGameOption } from "@/features/registration/domain/types";
import { formatBdt } from "@/lib/money";
import styles from "./registration.module.css";

const draftStorageKey = "ndcak-registration-draft";

type RegistrationDetailsInput = z.input<
  ReturnType<typeof createRegistrationDetailsSchema>
>;

type RegistrationDetailsFormProps = {
  games: RegistrationGameOption[];
  maxGames: number;
  departments: string[];
  academicYears: string[];
};

const emptyDetails: RegistrationDetailsInput = {
  fullName: "",
  studentId: "",
  email: "",
  phone: "",
  department: "",
  academicYear: "",
  selectedGameIds: [],
};

function placesText(remaining: number, open: boolean) {
  if (!open) return { text: "Registration closed", tone: "none" };
  if (remaining === 0) return { text: "Full", tone: "none" };
  if (remaining <= 5)
    return { text: `Only ${remaining} places left`, tone: "low" };
  return { text: `${remaining} places left`, tone: "ok" };
}

export function RegistrationDetailsForm({
  games,
  maxGames,
  departments,
  academicYears,
}: RegistrationDetailsFormProps) {
  const router = useRouter();
  const schema = useMemo(
    () => createRegistrationDetailsSchema(maxGames),
    [maxGames],
  );
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<RegistrationDetailsInput, unknown, RegistrationDetails>({
    resolver: zodResolver(schema),
    defaultValues: emptyDetails,
  });

  // Restore an unfinished draft, or preselect the game picked on the
  // landing page (/register?game=<id>). setValue keeps the inputs attached
  // to the form; reset() would detach them from the compiler-memoized refs.
  useEffect(() => {
    const fill = (values: Partial<RegistrationDetailsInput>) => {
      for (const [name, value] of Object.entries(values)) {
        setValue(name as keyof RegistrationDetailsInput, value as never, {
          shouldDirty: false,
        });
      }
    };

    const storedDraft = window.sessionStorage.getItem(draftStorageKey);
    if (storedDraft) {
      try {
        const parsed = schema.safeParse(JSON.parse(storedDraft));
        if (parsed.success) {
          fill(parsed.data);
          return;
        }
      } catch {
        window.sessionStorage.removeItem(draftStorageKey);
      }
    }

    const requested = new URLSearchParams(window.location.search).get("game");
    const game = games.find((item) => item.id === requested);
    if (game && game.registrationOpen && getRemainingCapacity(game) > 0) {
      fill({ selectedGameIds: [game.id] });
    }
  }, [setValue, schema, games]);

  const selectedGameIds = useWatch({ control, name: "selectedGameIds" }) ?? [];
  const selectedGames = games.filter((game) =>
    selectedGameIds.includes(game.id),
  );
  const totalFeeMinor = selectedGames.reduce(
    (total, game) => total + game.feeMinor,
    0,
  );
  const limitReached = selectedGames.length >= maxGames;

  function onSubmit(details: RegistrationDetails) {
    window.sessionStorage.setItem(draftStorageKey, JSON.stringify(details));
    router.push("/register/review");
  }

  return (
    <form
      className={`${styles.layout} ${styles.withBar}`}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className={styles.main}>
        <section className={styles.card} aria-labelledby="details-heading">
          <div className={styles.cardHeader}>
            <span className={styles.cardNumber}>1</span>
            <div>
              <h2 id="details-heading">Your details</h2>
              <p>
                We use these to confirm your place and reach you before your
                matches.
              </p>
            </div>
          </div>

          <div className={styles.fields}>
            <Field label="Full name" error={errors.fullName?.message} wide>
              <input
                autoComplete="name"
                placeholder="As on your student ID"
                {...register("fullName")}
              />
            </Field>
            <Field label="Student ID" error={errors.studentId?.message}>
              <input
                autoComplete="off"
                inputMode="numeric"
                placeholder="e.g. 2107042"
                {...register("studentId")}
              />
            </Field>
            <Field label="Academic year" error={errors.academicYear?.message}>
              <select {...register("academicYear")}>
                <option value="">Select your year</option>
                {academicYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department" error={errors.department?.message} wide>
              <select {...register("department")}>
                <option value="">Select your department</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
              />
            </Field>
            <Field
              label="Phone"
              hint="Bangladesh mobile"
              error={errors.phone?.message}
            >
              <input
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                {...register("phone")}
              />
            </Field>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="games-heading">
          <div className={styles.cardHeader}>
            <span className={styles.cardNumber}>2</span>
            <div>
              <h2 id="games-heading">Choose your games</h2>
              <p>Each game is its own competition. Pick up to {maxGames}.</p>
            </div>
          </div>

          <p className={styles.gameCounter} aria-live="polite">
            <b>{selectedGames.length}</b> of {maxGames} selected
            {limitReached ? ". Unselect a game to choose a different one." : ""}
          </p>

          <div className={styles.gameGrid}>
            {games.map((game) => {
              const remaining = getRemainingCapacity(game);
              const selected = selectedGameIds.includes(game.id);
              const unavailable =
                !game.registrationOpen ||
                remaining === 0 ||
                (limitReached && !selected);
              const places = placesText(remaining, game.registrationOpen);

              return (
                <label
                  className={`${styles.game} ${selected ? styles.gameSelected : ""} ${unavailable ? styles.gameDisabled : ""}`}
                  key={game.id}
                >
                  <input
                    type="checkbox"
                    value={game.id}
                    disabled={unavailable}
                    {...register("selectedGameIds")}
                  />
                  <span className={styles.check} aria-hidden="true">
                    {selected ? <Check size={15} strokeWidth={3.2} /> : null}
                  </span>
                  <span className={styles.gameName}>{game.name}</span>
                  <span className={styles.gameFee}>
                    {formatBdt(game.feeMinor)}
                  </span>
                  {game.description ? (
                    <span className={styles.gameDescription}>
                      {game.description}
                    </span>
                  ) : null}
                  <span className={styles.gamePlaces} data-tone={places.tone}>
                    <Users size={14} aria-hidden="true" /> {places.text}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.selectedGameIds?.message ? (
            <p className={styles.selectionError} role="alert">
              {errors.selectedGameIds.message}
            </p>
          ) : null}
        </section>
      </div>

      <aside className={styles.summary} aria-label="Registration summary">
        <p className={styles.summaryTitle}>Your registration</p>
        {selectedGames.length ? (
          <ul className={styles.summaryList}>
            {selectedGames.map((game) => (
              <li key={game.id}>
                <span>{game.name}</span>
                <b>{formatBdt(game.feeMinor)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.summaryEmpty}>
            No games selected yet. Pick at least one to continue.
          </p>
        )}
        <div className={styles.summaryTotal}>
          <span>Total fee</span>
          <strong>{formatBdt(totalFeeMinor)}</strong>
        </div>
        <button
          className={styles.primary}
          type="submit"
          disabled={isSubmitting}
        >
          Review registration <ArrowRight size={18} aria-hidden="true" />
        </button>
        <p className={styles.summaryNote}>
          Nothing is submitted yet. You will check everything before paying.
        </p>
      </aside>

      <div className={styles.mobileBar}>
        <div>
          <small>
            {selectedGames.length}{" "}
            {selectedGames.length === 1 ? "game" : "games"} · total
          </small>
          <strong>{formatBdt(totalFeeMinor)}</strong>
        </div>
        <button
          className={styles.primary}
          type="submit"
          disabled={isSubmitting}
        >
          Review <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  label: string;
  wide?: boolean;
};

function Field({ children, error, hint, label, wide }: FieldProps) {
  return (
    <label
      className={`${styles.field} ${wide ? styles.fieldWide : ""}`}
      data-invalid={error ? "true" : undefined}
    >
      <span className={styles.fieldLabel}>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
      {error ? (
        <em className={styles.fieldError} role="alert">
          {error}
        </em>
      ) : null}
    </label>
  );
}

export { draftStorageKey };
