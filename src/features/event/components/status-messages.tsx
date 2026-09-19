import styles from "./settings.module.css";

const messages: Record<string, string> = {
  tournament_created: "Tournament created. Fill in the event details below.",
  details_saved: "Event details saved. Public pages update within seconds.",
  status_updated: "Event status updated.",
  payment_method_saved: "Payment method saved.",
  game_added: "Game added as a draft. Review its settings, then open it.",
  game_saved: "Game settings saved.",
  game_removed: "Game removed from this event.",
};

const errors: Record<string, string> = {
  tournament_exists:
    "A tournament is already being managed. Archive it before starting another.",
  tournament_not_found: "That tournament is no longer available.",
  invalid_details: "Some event details are missing or invalid.",
  required_while_open:
    "Venue, event dates and the closing time cannot be cleared while registration is open.",
  invalid_status_change: "That status change is not allowed from here.",
  not_ready:
    "Registration cannot open yet. Complete the required checklist items first.",
  invalid_payment_method:
    "Check the payment method: name and receiving account are required.",
  payment_method_exists: "A payment method with that name already exists.",
  payment_method_not_found: "That payment method no longer exists.",
  invalid_game:
    "Check the game settings: fee and capacity must be whole numbers.",
  game_exists: "That game is already part of this event.",
  game_not_found: "That game is no longer part of this event.",
  capacity_below_taken:
    "Capacity cannot be lower than the places already reserved or confirmed.",
  game_has_entries:
    "Games with registrations cannot be removed. Close registration for it instead.",
  save_failed: "The change could not be saved. Try again.",
};

const fieldLabels: Record<string, string> = {
  name: "Event name",
  year: "Year",
  endsAt: "Event end",
  registrationCloseAt: "Registration closes",
  maxGamesPerParticipant: "Games per participant",
  departments: "Departments",
  academicYears: "Academic years",
};

export function StatusMessages({
  message,
  error,
  field,
}: {
  message?: string;
  error?: string;
  field?: string;
}) {
  if (error) {
    const fieldLabel = field ? fieldLabels[field] : undefined;

    return (
      <div className={styles.errorBanner} role="alert">
        {errors[error] ?? errors.save_failed}
        {fieldLabel ? ` Check “${fieldLabel}”.` : null}
      </div>
    );
  }

  if (message && messages[message]) {
    return (
      <div className={styles.banner} role="status">
        {messages[message]}
      </div>
    );
  }

  return null;
}
