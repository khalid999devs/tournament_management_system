import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import adminStyles from "@/features/admin/components/admin.module.css";
import styles from "@/features/event/components/settings.module.css";
import { StatusMessages } from "@/features/event/components/status-messages";
import {
  dateToDhakaInput,
  defaultAcademicYears,
  defaultDepartments,
  isReadyToOpen,
  nextStatuses,
  type TournamentStatus,
} from "@/features/event/domain/event-settings";
import {
  changeTournamentStatusAction,
  createTournamentAction,
  savePaymentMethodAction,
  updateEventDetailsAction,
} from "@/features/event/server/actions";
import { getEventSetup } from "@/features/event/server/event-queries";

export const metadata: Metadata = { title: "Event settings" };

const statusCopy: Record<TournamentStatus, { title: string; detail: string }> =
  {
    DRAFT: {
      title: "Draft",
      detail:
        "Only staff can see this configuration. Registration is closed to the public.",
    },
    REGISTRATION_OPEN: {
      title: "Registration open",
      detail: "Participants can register for games that are open.",
    },
    REGISTRATION_CLOSED: {
      title: "Registration closed",
      detail: "No new registrations. Pending payments can still be reviewed.",
    },
    IN_PROGRESS: {
      title: "In progress",
      detail: "The event is running. Matches and scoring happen here.",
    },
    COMPLETED: {
      title: "Completed",
      detail: "The event has finished. Archive it to start a new one.",
    },
    ARCHIVED: { title: "Archived", detail: "Kept for history only." },
  };

const transitionLabels: Record<TournamentStatus, string> = {
  DRAFT: "Back to draft",
  REGISTRATION_OPEN: "Open registration",
  REGISTRATION_CLOSED: "Close registration",
  IN_PROGRESS: "Start the event",
  COMPLETED: "Mark completed",
  ARCHIVED: "Archive event",
};

export default async function EventSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; field?: string }>;
}) {
  const [setup, status] = await Promise.all([getEventSetup(), searchParams]);

  return (
    <div className={adminStyles.content}>
      <header className={adminStyles.pageHeader}>
        <div>
          <p>Configuration</p>
          <h1>Event settings</h1>
          <span>
            Dates, venue, registration window and payment instructions shown to
            participants.
          </span>
        </div>
      </header>

      <StatusMessages {...status} />

      {setup ? <EventSetup setup={setup} /> : <CreateTournament />}
    </div>
  );
}

function CreateTournament() {
  return (
    <section className={styles.panel} aria-labelledby="create-title">
      <div className={styles.panelHeading}>
        <div>
          <p>Getting started</p>
          <h2 id="create-title">Create the tournament</h2>
          <span>
            Start with a name and year. It stays in draft, hidden from the
            public, until you open registration.
          </span>
        </div>
      </div>
      <form className={styles.formGrid} action={createTournamentAction}>
        <label className={styles.field}>
          <span>Event name</span>
          <input
            name="name"
            required
            minLength={3}
            maxLength={180}
            defaultValue="NDCAK Indoor Games Championship"
          />
        </label>
        <label className={styles.field}>
          <span>Year</span>
          <input
            name="year"
            type="number"
            required
            min={2020}
            max={2100}
            defaultValue={new Date().getFullYear()}
          />
        </label>
        <div className={styles.actions}>
          <button className={styles.primary} type="submit">
            Create tournament
          </button>
        </div>
      </form>
    </section>
  );
}

type Setup = NonNullable<Awaited<ReturnType<typeof getEventSetup>>>;

function EventSetup({ setup }: { setup: Setup }) {
  const { tournament, readiness, paymentMethods } = setup;
  const settings = tournament.publicSettings;
  const ready = isReadyToOpen(readiness);
  const copy = statusCopy[tournament.status];

  return (
    <>
      <section className={styles.statusBar} aria-label="Event status">
        <div>
          <p>{tournament.name}</p>
          <h2>{copy.title}</h2>
          <span>{copy.detail}</span>
        </div>
        <div className={styles.statusActions}>
          {nextStatuses(tournament.status).map((next) => (
            <form key={next} action={changeTournamentStatusAction}>
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <input type="hidden" name="status" value={next} />
              <button
                type="submit"
                data-variant={
                  next === "REGISTRATION_OPEN" ? undefined : "quiet"
                }
                disabled={next === "REGISTRATION_OPEN" && !ready}
              >
                {transitionLabels[next]}
              </button>
            </form>
          ))}
        </div>
      </section>

      {tournament.status === "DRAFT" ||
      tournament.status === "REGISTRATION_CLOSED" ? (
        <section className={styles.panel} aria-labelledby="readiness-title">
          <div className={styles.panelHeading}>
            <div>
              <p>Before opening registration</p>
              <h2 id="readiness-title">Readiness checklist</h2>
            </div>
            <span className={styles.pill} data-tone={ready ? "good" : "warn"}>
              {ready ? "Ready to open" : "Not ready"}
            </span>
          </div>
          <ul className={styles.checklist}>
            {readiness.map((check) => (
              <li
                key={check.key}
                data-ok={check.ok}
                data-optional={!check.required}
              >
                {check.ok ? (
                  <CheckCircle2 size={20} aria-hidden="true" />
                ) : check.required ? (
                  <CircleAlert size={20} aria-hidden="true" />
                ) : (
                  <CircleDashed size={20} aria-hidden="true" />
                )}
                {check.label}
                <small>
                  {check.ok
                    ? "Done"
                    : check.required
                      ? "Required"
                      : "Recommended"}
                </small>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Link className={styles.secondary} href="/admin/games">
              Manage games
            </Link>
            <a className={styles.secondary} href="#payments">
              Payment methods
            </a>
          </div>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="details-title">
        <div className={styles.panelHeading}>
          <div>
            <p>Public information</p>
            <h2 id="details-title">Event details</h2>
            <span>
              Times are entered in Bangladesh time (Asia/Dhaka). The start and
              end are used in the confirmation email and calendar invite.
            </span>
          </div>
        </div>
        <form className={styles.formGrid} action={updateEventDetailsAction}>
          <input type="hidden" name="tournamentId" value={tournament.id} />

          <p className={styles.sectionLabel}>Basics</p>
          <label className={styles.field}>
            <span>Event name</span>
            <input
              name="name"
              required
              minLength={3}
              maxLength={180}
              defaultValue={tournament.name}
            />
          </label>
          <label className={styles.field}>
            <span>Year</span>
            <input
              name="year"
              type="number"
              required
              min={2020}
              max={2100}
              defaultValue={tournament.year}
            />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>Venue</span>
            <input
              name="venue"
              maxLength={240}
              placeholder="e.g. KUET Student Welfare Centre, Khulna"
              defaultValue={tournament.venue ?? ""}
            />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>Short description</span>
            <textarea
              name="description"
              maxLength={600}
              defaultValue={settings.description ?? ""}
            />
            <small>
              Shown on the home page. Leave empty to use the default.
            </small>
          </label>

          <p className={styles.sectionLabel}>Dates</p>
          <DateField
            label="Event starts"
            name="startsAt"
            value={tournament.startsAt}
          />
          <DateField
            label="Event ends"
            name="endsAt"
            value={tournament.endsAt}
          />
          <DateField
            label="Registration opens"
            name="registrationOpenAt"
            value={tournament.registrationOpenAt}
            hint="Optional. Leave empty to accept registrations as soon as you open them."
          />
          <DateField
            label="Registration closes"
            name="registrationCloseAt"
            value={tournament.registrationCloseAt}
          />

          <p className={styles.sectionLabel}>Registration rules</p>
          <label className={styles.field}>
            <span>Games per participant</span>
            <input
              name="maxGamesPerParticipant"
              type="number"
              required
              min={1}
              max={20}
              defaultValue={tournament.maxGamesPerParticipant}
            />
            <small>The most games one person can enter.</small>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="resultsEnabled"
              defaultChecked={settings.resultsEnabled}
            />
            Publish approved results on the public Results page
          </label>
          <label className={styles.field}>
            <span>Departments</span>
            <textarea
              name="departments"
              className={styles.tall}
              required
              defaultValue={(settings.departments ?? defaultDepartments).join(
                "\n",
              )}
            />
            <small>One per line. Participants pick from this list.</small>
          </label>
          <label className={styles.field}>
            <span>Academic years</span>
            <textarea
              name="academicYears"
              className={styles.tall}
              required
              defaultValue={(
                settings.academicYears ?? defaultAcademicYears
              ).join("\n")}
            />
            <small>One per line.</small>
          </label>

          <p className={styles.sectionLabel}>Confirmation email</p>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>Check-in instructions</span>
            <textarea
              name="checkInInstructions"
              maxLength={600}
              placeholder="e.g. Report to the registration desk 30 minutes before your first match with your student ID card."
              defaultValue={settings.checkInInstructions ?? ""}
            />
            <small>
              Included in every confirmation email. Never include internal
              notes.
            </small>
          </label>

          <div className={styles.actions}>
            <button className={styles.primary} type="submit">
              Save event details
            </button>
          </div>
        </form>
      </section>

      <section
        className={styles.panel}
        id="payments"
        aria-labelledby="payments-title"
      >
        <div className={styles.panelHeading}>
          <div>
            <p>Manual verification</p>
            <h2 id="payments-title">Payment methods</h2>
            <span>
              Participants send the fee to one of these accounts and submit the
              transaction ID. Each registration keeps a copy of the account
              shown at the time, so later edits never change past records.
            </span>
          </div>
        </div>
        <div className={styles.list}>
          {paymentMethods.map((method) => (
            <details key={method.id} className={styles.methodCard}>
              <summary>
                <span>
                  <strong>{method.displayName}</strong>
                  <small>{method.receivingAccount}</small>
                </span>
                <span
                  className={styles.pill}
                  data-tone={method.enabled ? "good" : undefined}
                >
                  {method.enabled ? "Enabled" : "Disabled"}
                </span>
              </summary>
              <PaymentMethodForm tournamentId={tournament.id} method={method} />
            </details>
          ))}
          <details
            className={styles.methodCard}
            open={paymentMethods.length === 0}
          >
            <summary>
              <strong>Add a payment method</strong>
            </summary>
            <PaymentMethodForm tournamentId={tournament.id} method={null} />
          </details>
        </div>
      </section>
    </>
  );
}

function DateField({
  label,
  name,
  value,
  hint,
}: {
  label: string;
  name: string;
  value: Date | null;
  hint?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        name={name}
        type="datetime-local"
        defaultValue={dateToDhakaInput(value)}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function PaymentMethodForm({
  tournamentId,
  method,
}: {
  tournamentId: string;
  method: Setup["paymentMethods"][number] | null;
}) {
  return (
    <form className={styles.formGrid} action={savePaymentMethodAction}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="paymentMethodId" value={method?.id ?? ""} />
      <label className={styles.field}>
        <span>Name shown to participants</span>
        <input
          name="displayName"
          required
          minLength={2}
          maxLength={80}
          placeholder="e.g. bKash"
          defaultValue={method?.displayName ?? ""}
        />
        {method ? <small>Internal key: {method.provider}</small> : null}
      </label>
      <label className={styles.field}>
        <span>Receiving number or account</span>
        <input
          name="receivingAccount"
          required
          minLength={4}
          maxLength={120}
          placeholder="e.g. 01XXXXXXXXX (Personal)"
          defaultValue={method?.receivingAccount ?? ""}
        />
      </label>
      <label className={`${styles.field} ${styles.wide}`}>
        <span>Instructions</span>
        <textarea
          name="instructions"
          maxLength={1000}
          placeholder="e.g. Use Send Money and write your student ID as the reference."
          defaultValue={method?.instructions ?? ""}
        />
      </label>
      <label className={styles.field}>
        <span>Display order</span>
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={999}
          defaultValue={method?.sortOrder ?? 0}
        />
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={method?.enabled ?? true}
        />
        Offer this method to participants
      </label>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit">
          {method ? "Save payment method" : "Add payment method"}
        </button>
      </div>
    </form>
  );
}
