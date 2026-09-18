"use client";

import { ArrowRight, CheckCircle2, Copy, ShieldCheck } from "lucide-react";
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
    return <div className={styles.reviewState}>Loading payment details…</div>;
  }

  if (!details) {
    return (
      <div className={styles.reviewState}>
        <h2>No registration draft found</h2>
        <p>Complete your details and game selection before payment.</p>
        <Link href="/register">Start registration</Link>
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
      <div className={styles.reviewState}>
        <h2>Payment is not available yet</h2>
        <p>The committee has not published an approved receiving account.</p>
        <Link href="/register/review">Return to review</Link>
      </div>
    );
  }

  return (
    <form className={styles.paymentForm} action={formAction}>
      <input type="hidden" name="tournamentId" value={checkout.id} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="details" value={JSON.stringify(details)} />

      <section className={styles.amountPanel} aria-labelledby="amount-heading">
        <div>
          <p id="amount-heading">Amount to send</p>
          <strong>{formatBdt(quote.totalFeeMinor)}</strong>
        </div>
        <span>
          For <b>{quote.lines.length}</b>{" "}
          {quote.lines.length === 1 ? "game" : "games"}
        </span>
      </section>

      <fieldset className={styles.paymentMethods}>
        <legend>Select payment method</legend>
        <div>
          {checkout.paymentMethods.map((method) => (
            <label
              className={
                provider === method.provider ? styles.paymentMethodSelected : ""
              }
              key={method.provider}
            >
              <input
                type="radio"
                name="paymentProvider"
                value={method.provider}
                checked={provider === method.provider}
                onChange={() => setProvider(method.provider)}
              />
              <span>{method.displayName}</span>
              {provider === method.provider ? (
                <CheckCircle2 size={19} aria-label="Selected" />
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      <section className={styles.paymentInstruction}>
        <p>Send to {selectedMethod.displayName}</p>
        <div>
          <strong>{selectedMethod.receivingAccount}</strong>
          <button
            type="button"
            aria-label="Copy receiving account"
            onClick={() =>
              navigator.clipboard.writeText(selectedMethod.receivingAccount)
            }
          >
            <Copy size={17} aria-hidden="true" />
          </button>
        </div>
        {selectedMethod.instructions ? (
          <span>{selectedMethod.instructions}</span>
        ) : null}
      </section>

      <label className={styles.transactionField}>
        <span>Transaction ID</span>
        <input
          name="transactionId"
          minLength={4}
          maxLength={160}
          required
          autoComplete="off"
          placeholder={`${selectedMethod.displayName} transaction ID`}
        />
        <small>Copy the exact reference from your payment receipt.</small>
      </label>

      {state.status === "error" ? (
        <div className={styles.submissionError} role="alert">
          {state.message}
        </div>
      ) : null}

      <div className={styles.finalSubmission}>
        <div>
          <ShieldCheck size={22} aria-hidden="true" />
          <span>
            Submission creates a pending request. Your place is confirmed only
            after manual review.
          </span>
        </div>
        <button type="submit" disabled={pending || !idempotencyKey}>
          {pending ? "Submitting…" : "Submit for review"}
          {!pending ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
      </div>
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
