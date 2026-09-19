import { renderTransactionalEmail } from "./render-email";

type SharedInput = {
  recipientName: string;
  tournamentName: string;
  supportEmail: string;
};

export type OperationalEmailInput =
  | (SharedInput & {
      type: "EVENT_REMINDER";
      registrationCode: string;
      schedule: string;
      venue: string;
      checkInInstructions: string;
    })
  | (SharedInput & {
      type: "SCHEDULE_CHANGED";
      registrationCode: string;
      previousSchedule: string;
      newSchedule: string;
      venue: string;
      eventPageUrl: string;
    })
  | (SharedInput & {
      type: "SUPPORT_ACKNOWLEDGMENT";
      supportReference: string;
      topic: string;
    })
  | (SharedInput & {
      type: "OPERATOR_INVITE";
      invitationUrl: string;
      expiresDescription: string;
    });

export function buildOperationalEmail(input: OperationalEmailInput) {
  const shared = {
    greeting: `Hello ${input.recipientName},`,
    supportEmail: input.supportEmail,
  };

  switch (input.type) {
    case "EVENT_REMINDER":
      return renderTransactionalEmail(
        `${input.tournamentName}: your event reminder`,
        {
          ...shared,
          preview: `Your event is coming up. Here are your check-in details.`,
          eyebrow: "Event reminder",
          title: "Game day is close.",
          status: "Upcoming event",
          tone: "info",
          paragraphs: [
            `You are registered for ${input.tournamentName}. Here is what you need for check-in.`,
          ],
          details: [
            { label: "Registration code", value: input.registrationCode },
            { label: "When", value: input.schedule },
            { label: "Where", value: input.venue },
          ],
          notice: input.checkInInstructions,
          reference: input.registrationCode,
        },
      );

    case "SCHEDULE_CHANGED":
      return renderTransactionalEmail(
        `${input.tournamentName}: schedule changed`,
        {
          ...shared,
          preview: `Please review your updated event schedule.`,
          eyebrow: "Important event update",
          title: "The schedule has changed.",
          status: "Action recommended",
          tone: "attention",
          paragraphs: [
            `The schedule for ${input.tournamentName} has changed. Please use the new details below and check the event page before travelling.`,
          ],
          details: [
            { label: "Previous", value: input.previousSchedule },
            { label: "Now", value: input.newSchedule },
            { label: "Venue", value: input.venue },
          ],
          action: {
            label: "View event details",
            href: requireHttpUrl(input.eventPageUrl),
          },
          reference: input.registrationCode,
        },
      );

    case "SUPPORT_ACKNOWLEDGMENT":
      return renderTransactionalEmail(
        `${input.supportReference}: we received your message`,
        {
          ...shared,
          preview: "The NDCAK team received your support request.",
          eyebrow: "Support request",
          title: "We received your message.",
          status: "Support request received",
          tone: "info",
          paragraphs: [
            `The ${input.tournamentName} team received your message about ${input.topic}. We will reply to the email address you used to contact us.`,
            "If you have more information, reply to this email and keep the reference below in the subject line.",
          ],
          details: [
            { label: "Support reference", value: input.supportReference },
            { label: "Topic", value: input.topic },
          ],
          reference: input.supportReference,
        },
      );

    case "OPERATOR_INVITE":
      return renderTransactionalEmail(`Your NDCAK operator invitation`, {
        ...shared,
        preview: "You have been invited to the NDCAK tournament workspace.",
        eyebrow: "Team invitation",
        title: "Welcome to the team.",
        status: "Operator invitation",
        tone: "success",
        paragraphs: [
          `You have been invited to help run ${input.tournamentName}. Accept the invitation to set up your staff account.`,
          "Your access is limited to the tournament work assigned by an administrator. You will not have access to participant payment information.",
        ],
        notice: `This invitation ${input.expiresDescription}. If you did not expect it, you can safely ignore this email.`,
        action: {
          label: "Accept invitation",
          href: requireHttpUrl(input.invitationUrl),
        },
      });
  }
}

function requireHttpUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Email action URLs must use HTTP or HTTPS.");
  }

  return url.toString();
}
