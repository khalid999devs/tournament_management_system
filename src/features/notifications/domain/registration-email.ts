import { createCalendarInvitation } from "./calendar";
import { renderTransactionalEmail } from "./render-email";

export type RegistrationEmailInput = {
  type:
    | "REGISTRATION_SUBMITTED"
    | "REGISTRATION_APPROVED"
    | "REGISTRATION_REJECTED";
  registrationId: string;
  registrationCode: string;
  participantName: string;
  recipientEmail: string;
  tournamentName: string;
  tournamentSlug: string;
  timezone: string;
  venue: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  checkInInstructions?: string;
  rejectionReason: string | null;
  gameNames: string[];
  organizerEmail: string;
};

export type RegistrationEmail = Awaited<
  ReturnType<typeof renderTransactionalEmail>
> & {
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
};

export async function buildRegistrationEmail(
  input: RegistrationEmailInput,
): Promise<RegistrationEmail> {
  const games = input.gameNames.join(", ");
  const shared = {
    greeting: `Hello ${input.participantName},`,
    supportEmail: input.organizerEmail,
    reference: input.registrationCode,
  };

  if (input.type === "REGISTRATION_SUBMITTED") {
    return renderTransactionalEmail(
      `${input.registrationCode}: registration received`,
      {
        ...shared,
        preview: "We received your registration. Payment review is pending.",
        eyebrow: "Registration update",
        title: "We have your entry.",
        status: "Pending payment review",
        tone: "pending",
        paragraphs: [
          `We received your registration for ${input.tournamentName}. It is pending manual payment review and is not confirmed yet.`,
          "The event team will email you when your submission has been reviewed. Please keep your registration code for reference.",
        ],
        details: [
          { label: "Registration code", value: input.registrationCode },
          { label: "Selected games", value: games },
        ],
        notice:
          "Your place is not confirmed until the event team approves the payment information you submitted.",
      },
    );
  }

  if (input.type === "REGISTRATION_REJECTED") {
    return renderTransactionalEmail(
      `${input.registrationCode}: registration not confirmed`,
      {
        ...shared,
        preview: `An update about your ${input.tournamentName} registration.`,
        eyebrow: "Registration update",
        title: "Your entry was not confirmed.",
        status: "Not confirmed",
        tone: "attention",
        paragraphs: [
          `Your registration for ${input.tournamentName} was not confirmed.`,
          `Reason: ${input.rejectionReason ?? "The event team could not verify the submission."}`,
          "If you think this is a mistake, reply to this email and include your registration code.",
        ],
        details: [
          { label: "Registration code", value: input.registrationCode },
        ],
      },
    );
  }

  const startsAt = requireDate(input.startsAt, "start");
  const endsAt = requireDate(input.endsAt, "end");
  const eventTime = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: input.timezone,
  });
  const email = await renderTransactionalEmail(
    `${input.registrationCode}: registration confirmed`,
    {
      ...shared,
      preview: `Your ${input.tournamentName} entry is confirmed.`,
      eyebrow: "Registration update",
      title: "You are in.",
      status: "Registration confirmed",
      tone: "success",
      paragraphs: [
        `Your registration for ${input.tournamentName} is confirmed. We look forward to seeing you there.`,
        "Bring your student ID and registration code to check-in. A calendar invitation is attached to help you save the date.",
      ],
      details: [
        { label: "Registration code", value: input.registrationCode },
        { label: "Selected games", value: games },
        { label: "Starts", value: eventTime.format(startsAt) },
        { label: "Ends", value: eventTime.format(endsAt) },
        { label: "Time zone", value: input.timezone },
        ...(input.venue ? [{ label: "Venue", value: input.venue }] : []),
      ],
      notice: input.checkInInstructions,
    },
  );
  const invitation = createCalendarInvitation({
    uid: `registration-${input.registrationId}@ndcak`,
    title: input.tournamentName,
    description: `Registration ${input.registrationCode}. Games: ${games}`,
    location: input.venue ?? "",
    startsAt,
    endsAt,
    organizerEmail: input.organizerEmail,
  });

  return {
    ...email,
    attachments: [
      {
        filename: `${input.tournamentSlug}.ics`,
        content: Buffer.from(invitation, "utf8"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  };
}

function requireDate(date: Date | null, name: string) {
  if (!date)
    throw new Error(`Confirmed registration email requires event ${name}.`);
  return date;
}
