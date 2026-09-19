import styles from "./settings.module.css";

const messages: Record<string, string> = {
  tournament_created: "Tournament created. Fill in the event details below.",
  details_saved: "Event details saved. Public pages update within seconds.",
  status_updated: "Event status updated.",
  payment_method_saved: "Payment method saved.",
  game_added: "Game added as a draft. Review its settings, then open it.",
  game_saved: "Game settings saved.",
  game_removed: "Game removed from this event.",
  scoring_saved: "Scoring rules saved.",
  bracket_generated: "Draw made. Matches are ready for operators.",
  bracket_reset: "Draw removed. You can make a new one.",
  round_added: "Round added. Add its matches below.",
  match_added: "Match created.",
  match_deleted: "Match deleted.",
  match_reopened: "Result reopened. Correct the score and confirm it again.",
  match_postponed: "Match postponed.",
  match_resumed: "Match resumed.",
  match_cancelled: "Match cancelled.",
  schedule_saved: "Time and place saved.",
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
  invalid_scoring_rules:
    "Check the scoring settings: a value is missing or out of range.",
  scoring_locked:
    "Scoring rules are locked because matches in this game have started. Every result must use the same rules.",
  bracket_exists:
    "A draw already exists for this game. Reset the draw first (only possible before any match starts).",
  registration_open: "Close registration for this game before making the draw.",
  pending_reviews:
    "Some registrations for this game are still awaiting payment review. Approve or reject them first so no one is left out.",
  too_few_players: "At least two confirmed players are needed for a draw.",
  seeding_mismatch:
    "The seeding list must contain every confirmed player's registration code exactly once.",
  not_knockout:
    "This game uses manual progression. Add rounds and matches instead.",
  not_manual: "This game uses an automatic knockout draw.",
  invalid_round: "Give the round a name of 2–120 characters.",
  round_not_found: "That round no longer exists.",
  wrong_player_count: "Pick a number of players this game's scoring allows.",
  player_not_confirmed: "Only confirmed players can be placed in a match.",
  matches_started: "Matches have already started, so this cannot be undone.",
  has_assignments:
    "Operators are assigned to these rounds or matches. Revoke those assignments first.",
  no_bracket: "There is no draw to reset.",
  confirm_reset: "Type RESET to confirm removing the draw.",
  tournament_closed: "The tournament is closed.",
  match_not_found: "That match no longer exists.",
  invalid_schedule: "Enter a valid start time.",
  reason_required: "Enter a reason of at least 5 characters.",
  downstream_result_dependency:
    "The next match has already started. Reopen that match first.",
  match_closed: "That action is not possible in the match's current state.",
  unauthorized_scope: "You do not have access to this match.",
  not_found: "That match no longer exists.",
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
