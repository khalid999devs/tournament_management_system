import { createTransport, type Transporter } from "nodemailer";
import { getEmailEnv } from "@/lib/env/server";
import { emailLogo, emailLogoCid } from "./logo";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  idempotencyKey: string;
};

let transport: Transporter | undefined;

// The notification outbox claims each message before calling this, so a
// message is attempted once per claim.
export async function sendEmail(input: SendEmailInput) {
  const env = getEmailEnv();
  const { idempotencyKey, ...message } = input;

  transport ??= createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  const info = await transport.sendMail({
    from: { name: env.EMAIL_FROM_NAME, address: env.SMTP_USER },
    replyTo: env.EMAIL_REPLY_TO,
    headers: { "X-Entity-Ref-ID": idempotencyKey },
    ...message,
    // Every template shows the NDCAK mark from this inline attachment; Gmail
    // blocks SVG and data-URL images, but renders cid: images everywhere.
    attachments: [
      ...(message.attachments ?? []),
      {
        filename: "ndcak-logo.png",
        content: emailLogo.png,
        contentType: "image/png",
        cid: emailLogoCid,
        contentDisposition: "inline",
      },
    ],
  });

  return { id: info.messageId };
}
