"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/features/auth/server/staff-session";
import { processNotification } from "@/features/notifications/server/process-notification";
import { refreshPublicEvent } from "@/features/tournaments/server/get-registration-tournament";
import { signalTournamentChange } from "@/lib/realtime/signal";
import {
  RegistrationReviewError,
  reviewRegistration,
} from "./review-registration";

const registrationIdSchema = z.uuid();

export async function approveRegistrationAction(formData: FormData) {
  const destination = await runReviewAction(formData, "APPROVE");
  redirect(destination);
}

export async function rejectRegistrationAction(formData: FormData) {
  const destination = await runReviewAction(formData, "REJECT");
  redirect(destination);
}

export async function retryNotificationAction(formData: FormData) {
  await requireSuperAdmin();
  const notificationId = registrationIdSchema.parse(
    formData.get("notificationId"),
  );

  after(() => processNotification(notificationId));
  revalidatePath("/admin/notifications");
  redirect("/admin/notifications?message=retry_queued");
}

async function runReviewAction(
  formData: FormData,
  decision: "APPROVE" | "REJECT",
) {
  const registrationId = registrationIdSchema.safeParse(
    formData.get("registrationId"),
  );

  if (!registrationId.success) return "/admin/registrations?error=invalid_id";

  try {
    const staff = await requireSuperAdmin();
    const result = await reviewRegistration({
      registrationId: registrationId.data,
      decision,
      reason:
        typeof formData.get("reason") === "string"
          ? String(formData.get("reason"))
          : undefined,
      actorStaffId: staff.id,
    });

    if (result.notificationId) {
      after(() => processNotification(result.notificationId!));
    }
    after(() => signalTournamentChange("registration"));

    refreshPublicEvent();
    revalidatePath("/admin");
    revalidatePath("/admin/registrations");
    revalidatePath(`/admin/registrations/${registrationId.data}`);
    return `/admin/registrations/${registrationId.data}?message=${decision === "APPROVE" ? "approved" : "rejected"}`;
  } catch (error) {
    const code =
      error instanceof RegistrationReviewError
        ? error.code.toLowerCase()
        : "review_failed";
    return `/admin/registrations/${registrationId.data}?error=${encodeURIComponent(code)}`;
  }
}
