import { describe, expect, it } from "vitest";
import {
  csvCell,
  exportFilename,
  formatCsvDate,
  toCsv,
} from "@/features/analytics/domain/csv";

describe("csv cells", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Rahman, Abdur")).toBe('"Rahman, Abdur"');
    expect(csvCell('Said "hi"')).toBe('"Said ""hi"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("neutralises text that a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+8801712345678")).toBe("'+8801712345678");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("writes numbers as numbers, including negatives", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(150.5)).toBe("150.5");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("leaves empty values blank and writes dates in Dhaka time", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    const date = new Date("2026-10-04T03:30:05Z");
    expect(formatCsvDate(date)).toBe("2026-10-04 09:30:05");
    expect(csvCell(date)).toBe("2026-10-04 09:30:05");
  });
});

describe("csv files", () => {
  it("starts with a byte-order mark and ends rows with CRLF", () => {
    const csv = toCsv(["Name", "Fee"], [["Rahim", 50]]);
    expect(csv.startsWith("﻿Name,Fee\r\n")).toBe(true);
    expect(csv.endsWith("Rahim,50\r\n")).toBe(true);
  });

  it("names files after the report and the Dhaka date", () => {
    expect(
      exportFilename("registrations", new Date("2026-10-03T20:00:00Z")),
    ).toBe("ndcak-registrations-2026-10-04.csv");
  });
});
