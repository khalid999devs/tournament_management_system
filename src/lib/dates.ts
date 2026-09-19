export function formatDhakaDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}

const dhakaDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export function formatDhakaDate(value: Date | string) {
  return dhakaDate.format(new Date(value));
}

export function formatDhakaDateRange(start: string, end: string | null) {
  if (!end) return formatDhakaDate(start);
  return dhakaDate.formatRange(new Date(start), new Date(end));
}
