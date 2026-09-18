import { createCalendarInvitation } from "./calendar";

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

export type RegistrationEmail = {
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
};

export function buildRegistrationEmail(
  input: RegistrationEmailInput,
): RegistrationEmail {
  const games = input.gameNames.join(", ");
  const greeting = `Hello ${input.participantName},`;

  if (input.type === "REGISTRATION_SUBMITTED") {
    const subject = `${input.registrationCode}: registration received`;
    const paragraphs = [
      greeting,
      `We received your registration for ${input.tournamentName}. It is pending manual payment review and is not confirmed yet.`,
      `Registration code: ${input.registrationCode}`,
      `Selected games: ${games}`,
      "We will email you after the event team approves or rejects the submission.",
    ];

    return renderEmail(subject, paragraphs);
  }

  if (input.type === "REGISTRATION_REJECTED") {
    const subject = `${input.registrationCode}: registration not confirmed`;
    const paragraphs = [
      greeting,
      `Your registration for ${input.tournamentName} was not confirmed.`,
      `Reason: ${input.rejectionReason ?? "The event team could not verify the submission."}`,
      `Registration code: ${input.registrationCode}`,
      `If you need clarification, reply to this email at ${input.organizerEmail}.`,
    ];

    return renderEmail(subject, paragraphs);
  }

  const schedule = formatEventSchedule(input);
  const subject = `${input.registrationCode}: registration confirmed`;
  const paragraphs = [
    greeting,
    `Your registration for ${input.tournamentName} is confirmed.`,
    `Registration code: ${input.registrationCode}`,
    `Selected games: ${games}`,
    schedule,
    input.venue ? `Venue: ${input.venue}` : "",
    input.checkInInstructions ? `Check-in: ${input.checkInInstructions}` : "",
    "A calendar invitation is attached.",
  ].filter(Boolean);
  const invitation = createCalendarInvitation({
    uid: `registration-${input.registrationId}@ndcak`,
    title: input.tournamentName,
    description: `Registration ${input.registrationCode}. Games: ${games}`,
    location: input.venue ?? "",
    startsAt: requireDate(input.startsAt, "start"),
    endsAt: requireDate(input.endsAt, "end"),
    organizerEmail: input.organizerEmail,
  });

  return {
    ...renderEmail(subject, paragraphs),
    attachments: [
      {
        filename: `${input.tournamentSlug}.ics`,
        content: Buffer.from(invitation, "utf8"),
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
      },
    ],
  };
}

function renderEmail(subject: string, paragraphs: string[]) {
  const text = paragraphs.join("\n\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f3ee;color:#0d1b39;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:40px 24px"><div style="background:#0d1b39;color:#fff;padding:24px 28px"><strong style="color:#e4c27a;letter-spacing:.08em">NDCAK</strong><h1 style="font-size:28px;margin:12px 0 0">${escapeHtml(subject)}</h1></div><div style="background:#fff;padding:30px 28px;border:1px solid #d9dce4">${paragraphs.map((paragraph) => `<p style="font-size:15px;line-height:1.65;margin:0 0 18px">${escapeHtml(paragraph)}</p>`).join("")}</div></div></body></html>`;

  return { subject, text, html };
}

function formatEventSchedule(input: RegistrationEmailInput) {
  const startsAt = requireDate(input.startsAt, "start");
  const endsAt = requireDate(input.endsAt, "end");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: input.timezone,
  });

  return `Event: ${formatter.format(startsAt)} – ${formatter.format(endsAt)}`;
}

function requireDate(date: Date | null, name: string) {
  if (!date)
    throw new Error(`Confirmed registration email requires event ${name}.`);
  return date;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}
