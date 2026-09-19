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
    reset,
  } = useForm<RegistrationDetailsInput, unknown, RegistrationDetails>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      studentId: "",
      email: "",
      phone: "",
      department: "",
      academicYear: "",
      selectedGameIds: [],
    },
  });

  useEffect(() => {
    const storedDraft = window.sessionStorage.getItem(draftStorageKey);

    if (!storedDraft) return;

    try {
      const parsed = schema.safeParse(JSON.parse(storedDraft));

      if (parsed.success) {
        reset(parsed.data);
      }
    } catch {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [reset, schema]);

  const selectedGameIds = useWatch({ control, name: "selectedGameIds" }) ?? [];
  const selectedGames = games.filter((game) =>
    selectedGameIds.includes(game.id),
  );
  const totalFeeMinor = selectedGames.reduce(
    (total, game) => total + game.feeMinor,
    0,
  );

  function onSubmit(details: RegistrationDetails) {
    window.sessionStorage.setItem(draftStorageKey, JSON.stringify(details));
    router.push("/register/review");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <section
        className={styles.panel}
        aria-labelledby="student-information-heading"
      >
        <div className={styles.panelHeading}>
          <span>01</span>
          <div>
            <h2 id="student-information-heading">Student information</h2>
            <p>Use details the event team can verify and contact.</p>
          </div>
        </div>

        <div className={styles.fieldsGrid}>
          <Field label="Full name" error={errors.fullName?.message} wide>
            <input autoComplete="name" {...register("fullName")} />
          </Field>
          <Field label="Student ID" error={errors.studentId?.message}>
            <input autoComplete="off" {...register("studentId")} />
          </Field>
          <Field label="Academic year" error={errors.academicYear?.message}>
            <select {...register("academicYear")}>
              <option value="">Select year</option>
              {academicYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department" error={errors.department?.message} wide>
            <select {...register("department")}>
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field
            label="Phone"
            hint="Bangladesh mobile number"
            error={errors.phone?.message}
          >
            <input type="tel" autoComplete="tel" {...register("phone")} />
          </Field>
        </div>
      </section>

      <section
        className={styles.panel}
        aria-labelledby="game-selection-heading"
      >
        <div className={styles.panelHeading}>
          <span>02</span>
          <div>
            <h2 id="game-selection-heading">Choose your games</h2>
            <p>
              Select up to {maxGames}. Pending reservations are already
              reflected in availability.
            </p>
          </div>
        </div>

        <div className={styles.gameGrid}>
          {games.map((game) => {
            const remaining = getRemainingCapacity(game);
            const selected = selectedGameIds.includes(game.id);
            const unavailable = !game.registrationOpen || remaining === 0;

            return (
              <label
                className={`${styles.gameOption} ${selected ? styles.gameOptionSelected : ""} ${unavailable ? styles.gameOptionDisabled : ""}`}
                key={game.id}
              >
                <input
                  type="checkbox"
                  value={game.id}
                  disabled={unavailable}
                  {...register("selectedGameIds")}
                />
                <span className={styles.gameCheck} aria-hidden="true">
                  {selected && <Check size={16} strokeWidth={3} />}
                </span>
                <span className={styles.gameCopy}>
                  <strong>{game.name}</strong>
                  <small>{game.description}</small>
                  <span className={styles.gameMeta}>
                    <b>{formatBdt(game.feeMinor)}</b>
                    <span>
                      <Users size={14} aria-hidden="true" /> {remaining} left
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.selectedGameIds?.message && (
          <p className={styles.selectionError} role="alert">
            {errors.selectedGameIds.message}
          </p>
        )}
      </section>

      <div className={styles.summaryBar}>
        <div>
          <span>{selectedGames.length} games selected</span>
          <strong>{formatBdt(totalFeeMinor)}</strong>
          <small>Total expected fee</small>
        </div>
        <button type="submit" disabled={isSubmitting}>
          Review details <ArrowRight size={18} aria-hidden="true" />
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
    <label className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
      {error && <em role="alert">{error}</em>}
    </label>
  );
}

export { draftStorageKey };
