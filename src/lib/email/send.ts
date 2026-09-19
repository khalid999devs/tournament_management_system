import { createTransport, type Transporter } from "nodemailer";
import { Resend } from "resend";
import { getEmailEnv, type EmailEnv } from "@/lib/env/server";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  idempotencyKey: string;
};

let resendClient: Resend | undefined;
let smtpTransport: Transporter | undefined;

function getSmtpTransport(env: Extract<EmailEnv, { transport: "smtp" }>) {
  smtpTransport ??= createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return smtpTransport;
}

// The notification outbox claims each message before calling this, so a
// message is attempted once per claim whichever transport is configured.
export async function sendEmail(input: SendEmailInput) {
  const env = getEmailEnv();
  const { idempotencyKey, ...message } = input;

  if (env.transport === "smtp") {
    const info = await getSmtpTransport(env).sendMail({
      from: { name: env.EMAIL_FROM_NAME, address: env.SMTP_USER },
      replyTo: env.EMAIL_REPLY_TO,
      headers: { "X-Entity-Ref-ID": idempotencyKey },
      ...message,
    });
    return { id: info.messageId };
  }

  resendClient ??= new Resend(env.RESEND_API_KEY);
  const { data, error } = await resendClient.emails.send(
    { from: env.EMAIL_FROM, replyTo: env.EMAIL_REPLY_TO, ...message },
    { idempotencyKey },
  );

  if (error) {
    throw new Error("Email delivery failed.", { cause: error });
  }

  return data;
}
