import { describe, expect, it } from "vitest";
import {
  formatEventSchedule,
  isReminderDue,
  reminderKey,
  reminderSendDay,
  zonedDay,
} from "@/features/notifications/domain/reminders";

const tz = "Asia/Dhaka";
// Saturday 10 October 2026, 10:00 in Dhaka.
const startsAt = new Date("2026-10-10T04:00:00Z");

describe("reminder timing", () => {
  it("uses the calendar day in the event's time zone", () => {
    // 23:30 UTC on the 9th is already the 10th in Dhaka.
    expect(zonedDay(new Date("2026-10-09T23:30:00Z"), tz)).toBe("2026-10-10");
    expect(reminderSendDay(startsAt, 1, tz)).toBe("2026-10-09");
    expect(reminderSendDay(startsAt, 7, tz)).toBe("2026-10-03");
  });

  it("is due from the send day until the event starts", () => {
    const due = (iso: string, daysBefore = 1) =>
      isReminderDue({ now: new Date(iso), startsAt, daysBefore, timeZone: tz });

    // 23:59 on the 8th in Dhaka: too early.
    expect(due("2026-10-08T17:59:00Z")).toBe(false);
    // Midnight on the 9th in Dhaka: due.
    expect(due("2026-10-08T18:00:00Z")).toBe(true);
    // The daily run at 09:00 Dhaka on the 9th.
    expect(due("2026-10-09T03:00:00Z")).toBe(true);
    // Still due on the morning of the event, for late confirmations.
    expect(due("2026-10-10T03:59:00Z")).toBe(true);
    // Never once the event has started.
    expect(due("2026-10-10T04:00:00Z")).toBe(false);
    expect(due("2026-10-05T03:00:00Z", 7)).toBe(true);
  });

  it("keys a reminder by registration and event day", () => {
    expect(reminderKey("reg-1", startsAt, tz)).toBe(
      "event-reminder:reg-1:2026-10-10",
    );
    const moved = new Date("2026-10-17T04:00:00Z");
    expect(reminderKey("reg-1", moved, tz)).not.toBe(
      reminderKey("reg-1", startsAt, tz),
    );
  });
});

describe("event schedule wording", () => {
  it("describes a one-day event with start and end times", () => {
    expect(
      formatEventSchedule(startsAt, new Date("2026-10-10T12:00:00Z"), tz),
    ).toBe("Saturday 10 October 2026, 10:00 am to 6:00 pm");
  });

  it("describes a multi-day event and an open end", () => {
    expect(
      formatEventSchedule(startsAt, new Date("2026-10-12T12:00:00Z"), tz),
    ).toBe(
      "Saturday 10 October 2026 at 10:00 am, until Monday 12 October 2026",
    );
    expect(formatEventSchedule(startsAt, null, tz)).toBe(
      "Saturday 10 October 2026, from 10:00 am",
    );
  });
});
