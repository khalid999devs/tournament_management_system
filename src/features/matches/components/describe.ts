import type { MatchEntrant, MatchLogItem } from "../server/match-queries";

export function seatName(entrants: MatchEntrant[], seat: number) {
  return (
    entrants.find((entrant) => entrant.seat === seat)?.name ?? `Seat ${seat}`
  );
}

const phaseLabel: Record<string, string> = {
  REGULAR: "",
  EXTRA_TIME: " (extra time)",
  PENALTIES: " (penalty)",
};

// A readable line for each score event; the raw payload stays in the log.
export function describeEvent(
  event: Record<string, unknown>,
  entrants: MatchEntrant[],
) {
  const name = (seat: unknown) => seatName(entrants, Number(seat));
  switch (event.type) {
    case "GOAL":
      return `Goal: ${name(event.seat)}${phaseLabel[String(event.phase)] ?? ""}`;
    case "POINT":
      return `Point: ${name(event.seat)} (set ${event.set})`;
    case "SET": {
      const [a, b] = event.points as [number, number];
      return `Set ${event.set} entered: ${a}–${b}`;
    }
    case "BOARD":
      return `Board: ${name(event.seat)} +${event.points}`;
    case "HAND": {
      const deltas = Object.entries(event.deltas as Record<string, number>)
        .filter(([, delta]) => delta !== 0)
        .map(
          ([seat, delta]) => `${name(seat)} ${delta > 0 ? "+" : ""}${delta}`,
        );
      return `Hand: ${deltas.join(", ")}`;
    }
    case "VALUE":
      return event.value === null
        ? `Cleared ${name(event.seat)}`
        : `${name(event.seat)}: ${event.value}`;
    case "FINISH":
      return event.finish === null
        ? `Cleared finish: ${name(event.seat)}`
        : `${name(event.seat)} finished #${event.finish}`;
    case "KILL":
      return `Elimination: ${name(event.seat)}`;
    case "TIEBREAK":
      return `Tie-break order: ${(event.order as number[]).map(name).join(" › ")}`;
    default:
      return "Score update";
  }
}

export function describeLogItem(item: MatchLogItem, entrants: MatchEntrant[]) {
  const payload = item.payload;
  switch (item.type) {
    case "STARTED":
      return "Match started";
    case "SCORE_EVENT":
      return describeEvent(payload.event as Record<string, unknown>, entrants);
    case "SCORE_VOIDED":
      return "Undid an earlier action";
    case "SCORE_SET":
      return "Score typed in";
    case "FINALIZED":
      return `Result confirmed: ${String(payload.displayScore ?? "")}`;
    case "WALKOVER": {
      const absent = (payload.absentSeats as number[]) ?? [];
      return absent.length
        ? `Walkover. Absent: ${absent.map((seat) => seatName(entrants, seat)).join(", ")}`
        : "Walkover";
    }
    case "REOPENED":
      return `Reopened for correction: ${String(payload.reason ?? "")}`;
    case "POSTPONED":
      return `Postponed: ${String(payload.reason ?? "")}`;
    case "RESUMED":
      return "Resumed";
    case "CANCELLED":
      return `Cancelled: ${String(payload.reason ?? "")}`;
    case "ENTRANT_ADVANCED":
      return `Winner arrived in seat ${String(payload.seat)}`;
    case "ENTRANT_WITHDRAWN":
      return "Earlier result reopened, competitor withdrawn";
    default:
      return item.type;
  }
}

const dhakaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatClock(value: string | Date) {
  return dhakaTime.format(new Date(value));
}
