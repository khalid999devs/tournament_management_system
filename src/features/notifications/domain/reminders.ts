export const reminderDayOptions = [1, 2, 3, 7] as const;

// Calendar day in the event's time zone, as YYYY-MM-DD.
export function zonedDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The reminder goes out on the calendar day N days before the event's first
// day, in the event's time zone.
export function reminderSendDay(
  startsAt: Date,
  daysBefore: number,
  timeZone: string,
) {
  return addDays(zonedDay(startsAt, timeZone), -daysBefore);
}

// Due from the send day until the event starts, so a player confirmed after
// the send day still gets one from the next daily run.
export function isReminderDue(input: {
  now: Date;
  startsAt: Date;
  daysBefore: number;
  timeZone: string;
}) {
  if (input.now >= input.startsAt) return false;
  return (
    zonedDay(input.now, input.timeZone) >=
    reminderSendDay(input.startsAt, input.daysBefore, input.timeZone)
  );
}

// One reminder per registration per event date. If the date moves, players
// hear about the new one.
export function reminderKey(
  registrationId: string,
  startsAt: Date,
  timeZone: string,
) {
  return `event-reminder:${registrationId}:${zonedDay(startsAt, timeZone)}`;
}

// Built from date parts so the wording is identical on every server,
// whatever its ICU version: "Saturday 10 October 2026", "10:00 am".
function parts(date: Date, options: Intl.DateTimeFormatOptions) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", options)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}

function longDay(date: Date, timeZone: string) {
  const day = parts(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
  return `${day.weekday} ${day.day} ${day.month} ${day.year}`;
}

function clock(date: Date, timeZone: string) {
  const time = parts(date, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
  return `${time.hour}:${time.minute} ${time.dayPeriod.toLowerCase()}`;
}

export function formatEventSchedule(
  startsAt: Date,
  endsAt: Date | null,
  timeZone: string,
) {
  const start = `${longDay(startsAt, timeZone)}`;
  if (!endsAt) return `${start}, from ${clock(startsAt, timeZone)}`;
  if (zonedDay(startsAt, timeZone) === zonedDay(endsAt, timeZone)) {
    return `${start}, ${clock(startsAt, timeZone)} to ${clock(endsAt, timeZone)}`;
  }
  return `${start} at ${clock(startsAt, timeZone)}, until ${longDay(endsAt, timeZone)}`;
}
