// Spreadsheet apps run a cell that starts with one of these as a formula, so
// text from participants is prefixed with an apostrophe (OWASP CSV
// injection guidance). Numbers are written as they are.
const formulaStart = /^[=+\-@\t\r]/;

const dhakaStamp = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// 2026-10-04 09:30:05, in Dhaka time.
export function formatCsvDate(value: Date) {
  return dhakaStamp.format(value).replace(",", "");
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number")
    return Number.isFinite(value) ? `${value}` : "";
  let text = value instanceof Date ? formatCsvDate(value) : String(value);
  if (formulaStart.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// RFC 4180 rows with a byte-order mark, so Excel reads UTF-8 names correctly.
export function toCsv(headers: string[], rows: unknown[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function exportFilename(kind: string, now = new Date()) {
  return `ndcak-${kind}-${formatCsvDate(now).slice(0, 10)}.csv`;
}
