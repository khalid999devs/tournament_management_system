"use client";

import { ArrowRight, Check, Copy, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { calculateRegistrationQuote } from "@/features/registration/domain/quote";
import {
  createRegistrationDetailsSchema,
  type RegistrationDetails,
} from "@/features/registration/domain/schemas";
import type { RegistrationCheckout } from "@/features/registration/domain/types";
import {
  submitRegistrationAction,
  type SubmitRegistrationState,
} from "@/features/registration/server/actions";
import { formatBdt } from "@/lib/money";
import { draftStorageKey } from "./registration-details-form";
import styles from "./registration.module.css";

const idempotencyStorageKey = "ndcak-registration-idempotency";
const initialState: SubmitRegistrationState = { status: "idle" };

export function RegistrationPayment({
  checkout,
}: {
  checkout: RegistrationCheckout;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    submitRegistrationAction,
    initialState,
  );
  const [provider, setProvider] = useState(
    checkout.paymentMethods[0]?.provider ?? "",
  );
  const [copied, setCopied] = useState(false);
  const idempotencyKey =
    useSyncExternalStore(
      subscribeToDraft,
      readIdempotencyKey,
      getServerDraft,
    ) ?? "";
  const storedDraft = useSyncExternalStore(
    subscribeToDraft,
    readDraft,
    getServerDraft,
  );
  const details = useMemo(
    () => parseDraft(storedDraft, checkout.maxGamesPerParticipant),
    [checkout.maxGamesPerParticipant, storedDraft],
  );

  useEffect(() => {
    if (state.status !== "success" || !state.registrationCode) return;

    window.sessionStorage.removeItem(draftStorageKey);
    window.sessionStorage.removeItem(idempotencyStorageKey);
    router.replace(
      `/register/submitted?code=${encodeURIComponent(state.registrationCode)}`,
    );
  }, [router, state]);

  if (details === undefined) {
    return <div className={styles.state}>Loading payment details…</div>;
  }

  if (!details) {
    return (
      <div className={styles.state}>
        <h2>Nothing to pay for yet</h2>
        <p>Fill in your details and choose your games first.</p>
        <Link className={styles.primary} href="/register">
          Start registration
        </Link>
      </div>
    );
  }

  const quote = calculateRegistrationQuote(
    checkout.games,
    details.selectedGameIds,
    checkout.maxGamesPerParticipant,
  );
  const selectedMethod = checkout.paymentMethods.find(
    (method) => method.provider === provider,
  );

  if (!selectedMethod) {
    return (
      <div className={styles.state}>
        <h2>Payment is not available yet</h2>
        <p>
          Payment details have not been published. Please check back shortly.
        </p>
        <Link className={styles.primary} href="/register/review">
          Back to review
        </Link>
      </div>
    );
  }

  async function copyAccount(account: string) {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form className={styles.layout} action={formAction}>
      <input type="hidden" name="tournamentId" value={checkout.id} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="details" value={JSON.stringify(details)} />

      <div className={styles.main}>
        <section className={styles.card} aria-labelledby="method-heading">
          <div className={styles.cardHeader}>
            <span className={styles.cardNumber}>1</span>
            <div>
              <h2 id="method-heading">Choose how you pay</h2>
              <p>Use any of these mobile banking services.</p>
            </div>
          </div>
          <fieldset className={styles.methods}>
            <legend className="visually-hidden">Payment method</legend>
            {checkout.paymentMethods.map((method) => {
              const selected = provider === method.provider;
              return (
                <label
                  className={`${styles.method} ${selected ? styles.methodSelected : ""}`}
                  key={method.provider}
                >
                  <input
                    type="radio"
                    name="paymentProvider"
                    value={method.provider}
                    checked={selected}
                    onChange={() => {
                      setProvider(method.provider);
                      setCopied(false);
                    }}
                  />
                  {selected ? (
                    <Check size={17} strokeWidth={3} aria-hidden="true" />
                  ) : null}
                  {method.displayName}
                </label>
              );
            })}
          </fieldset>
        </section>

        <section className={styles.card} aria-labelledby="send-heading">
          <div className={styles.cardHeader}>
            <span className={styles.cardNumber}>2</span>
            <div>
              <h2 id="send-heading">Send the exact amount</h2>
              <p>
                Send the total in one payment to this{" "}
                {selectedMethod.displayName} number.
              </p>
            </div>
          </div>
          <div className={styles.amount}>
            <span>
              Total for {quote.lines.length}{" "}
              {quote.lines.length === 1 ? "game" : "games"}
            </span>
            <strong>{formatBdt(quote.totalFeeMinor)}</strong>
          </div>
          <div className={styles.account}>
            <div>
              <small>{selectedMethod.displayName} number</small>
              <strong>{selectedMethod.receivingAccount}</strong>
            </div>
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => void copyAccount(selectedMethod.receivingAccount)}
            >
              {copied ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {selectedMethod.instructions ? (
            <p className={styles.instructions}>{selectedMethod.instructions}</p>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="reference-heading">
          <div className={styles.cardHeader}>
            <span className={styles.cardNumber}>3</span>
            <div>
              <h2 id="reference-heading">Enter your transaction ID</h2>
              <p>
                You will find it in the confirmation SMS or in your app&apos;s
                transaction history.
              </p>
            </div>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Transaction ID</span>
            <input
              name="transactionId"
              minLength={4}
              maxLength={160}
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. 9FX4K2LQ7A"
            />
          </label>

          {state.status === "error" ? (
            <p className={styles.submitError} role="alert">
              {state.message}
            </p>
          ) : null}

          <p className={styles.notice}>
            <ShieldCheck size={18} aria-hidden="true" />
            Your place is held once you submit and confirmed by email after the
            committee checks your payment.
          </p>
          <button
            className={`${styles.primary} ${styles.submitButton}`}
            type="submit"
            disabled={pending || !idempotencyKey}
          >
            {pending ? "Submitting…" : "Submit registration"}
            {!pending ? <ArrowRight size={18} aria-hidden="true" /> : null}
          </button>
        </section>
      </div>

      <aside
        className={`${styles.summary} ${styles.summaryStatic}`}
        aria-label="Registration summary"
      >
        <p className={styles.summaryTitle}>Your registration</p>
        <ul className={styles.summaryList}>
          {quote.lines.map((line) => (
            <li key={line.gameId}>
              <span>{line.name}</span>
              <b>{formatBdt(line.feeMinor)}</b>
            </li>
          ))}
        </ul>
        <div className={styles.summaryTotal}>
          <span>Total fee</span>
          <strong>{formatBdt(quote.totalFeeMinor)}</strong>
        </div>
        <dl className={styles.detailsList}>
          <div>
            <dt>Player</dt>
            <dd>{details.fullName}</dd>
          </div>
          <div>
            <dt>Student ID</dt>
            <dd>{details.studentId}</dd>
          </div>
        </dl>
      </aside>
    </form>
  );
}

function subscribeToDraft() {
  return () => undefined;
}

function readDraft() {
  return window.sessionStorage.getItem(draftStorageKey);
}

function readIdempotencyKey() {
  const stored = window.sessionStorage.getItem(idempotencyStorageKey);

  if (stored) return stored;

  const generated = crypto.randomUUID();
  window.sessionStorage.setItem(idempotencyStorageKey, generated);
  return generated;
}

function getServerDraft() {
  return undefined;
}

function parseDraft(
  storedDraft: string | null | undefined,
  maxGames: number,
): RegistrationDetails | null | undefined {
  if (storedDraft === undefined) return undefined;
  if (storedDraft === null) return null;

  try {
    const parsed = createRegistrationDetailsSchema(maxGames).safeParse(
      JSON.parse(storedDraft),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
