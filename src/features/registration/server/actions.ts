"use server";

import { after } from "next/server";
import { ZodError } from "zod";
import { processNotification } from "@/features/notifications/server/process-notification";
import { RegistrationDomainError } from "@/features/registration/domain/errors";
import { registrationSubmissionSchema } from "@/features/registration/domain/schemas";
import { refreshPublicEvent } from "@/features/tournaments/server/get-registration-tournament";
import { signalTournamentChange } from "@/lib/realtime/signal";
import { submitRegistration } from "./submit-registration";

export type SubmitRegistrationState = {
  status: "idle" | "error" | "success";
  message?: string;
  registrationCode?: string;
};

export async function submitRegistrationAction(
  _previousState: SubmitRegistrationState,
  formData: FormData,
): Promise<SubmitRegistrationState> {
  try {
    const detailsValue = formData.get("details");
    const details =
      typeof detailsValue === "string" ? JSON.parse(detailsValue) : null;
    const input = registrationSubmissionSchema.parse({
      tournamentId: formData.get("tournamentId"),
      idempotencyKey: formData.get("idempotencyKey"),
      details,
      paymentProvider: formData.get("paymentProvider"),
      transactionId: formData.get("transactionId"),
    });
    const result = await submitRegistration(input);
    refreshPublicEvent();

    if (result.notificationId) {
      after(() => processNotification(result.notificationId!));
    }
    // Open admin screens show the new registration straight away.
    after(() => signalTournamentChange("registration", input.tournamentId));

    return {
      status: "success",
      registrationCode: result.registrationCode,
    };
  } catch (error) {
    // A full or closed game means the cached availability is out of date.
    if (error instanceof RegistrationDomainError) refreshPublicEvent();

    return {
      status: "error",
      message: getParticipantError(error),
    };
  }
}

function getParticipantError(error: unknown) {
  if (error instanceof RegistrationDomainError) return error.message;

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return "Check your registration and payment information, then try again.";
  }

  return "We could not submit the registration. No place was reserved; please try again.";
}
