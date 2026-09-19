import { render } from "react-email";
import {
  TransactionalEmail,
  type TransactionalEmailProps,
} from "@/features/notifications/templates/transactional-email";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export async function renderTransactionalEmail(
  subject: string,
  props: TransactionalEmailProps,
): Promise<RenderedEmail> {
  const template = <TransactionalEmail {...props} />;
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ]);

  return { subject, html, text };
}
