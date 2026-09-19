"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/features/auth/server/staff-session";
import { reminderDayOptions } from "../domain/reminders";
import {
  queueEventReminders,
  ReminderError,
  saveReminderSetting,
  sendQueuedNotifications,
} from "./reminders";

const panel = "/admin/event";
const anchor = "#reminders";
const errorCodes: Record<string, string> = {
  NO_TOURNAMENT: "tournament_not_found",
  NEEDS_DATES: "reminder_needs_dates",
  EVENT_STARTED: "reminder_closed",
};

export async function saveReminderSettingAction(formData: FormData) {
  const staff = await requireSuperAdmin();
  const raw = String(formData.get("daysBefore") ?? "");
  const days = raw === "" ? null : Number(raw);
  if (
    days !== null &&
    !reminderDayOptions.includes(days as (typeof reminderDayOptions)[number])
  ) {
    redirect(`${panel}?error=reminder_invalid${anchor}`);
  }

  let target = `${panel}?message=reminder_saved${anchor}`;
  try {
    await saveReminderSetting({ actorId: staff.id, daysBefore: days });
    revalidatePath(panel);
  } catch (error) {
    target = `${panel}?error=${error instanceof ReminderError ? errorCodes[error.code] : "save_failed"}${anchor}`;
  }
  redirect(target);
}

// Sends the reminder now to every confirmed player who has not had it for
// this event date. Sending continues after the page reloads.
export async function sendRemindersNowAction() {
  const staff = await requireSuperAdmin();
  let target = `${panel}?message=reminders_queued${anchor}`;
  try {
    const { queued } = await queueEventReminders({
      now: new Date(),
      force: true,
      actorId: staff.id,
    });
    if (queued === 0) target = `${panel}?message=reminders_none${anchor}`;
    const started = Date.now();
    after(() =>
      sendQueuedNotifications({
        deadline: started + 240_000,
        types: ["EVENT_REMINDER"],
      }),
    );
    revalidatePath(panel);
  } catch (error) {
    target = `${panel}?error=${error instanceof ReminderError ? errorCodes[error.code] : "save_failed"}${anchor}`;
  }
  redirect(target);
}
