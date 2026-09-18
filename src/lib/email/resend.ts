import { Resend } from "resend";
import type { Attachment } from "resend";
import { getEmailEnv } from "@/lib/env/server";

let resendClient: Resend | undefined;

export function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(getEmailEnv().RESEND_API_KEY);
  }

  return resendClient;
}

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
  idempotencyKey: string;
};

export async function sendEmail(input: SendEmailInput) {
  const env = getEmailEnv();
  const { idempotencyKey, ...message } = input;
  const { data, error } = await getResendClient().emails.send(
    {
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
      ...message,
    },
    { idempotencyKey },
  );

  if (error) {
    throw new Error("Email delivery failed.", { cause: error });
  }

  return data;
}
