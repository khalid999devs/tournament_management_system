# Email Integration

## Application email

The application uses the official Resend SDK from server-only code in `src/lib/email/resend.ts`.

Environment contract:

- `RESEND_API_KEY` - secret API key; never client-exposed or committed.
- `EMAIL_FROM` - verified sender identity.
- `EMAIL_REPLY_TO` - organizer inbox for participant replies.
- `SUPER_ADMIN_EMAIL` - initial Super Admin identity; not a delivery credential.

Current development configuration uses `onboarding@resend.dev` as the sender and `ndcakofficial@gmail.com` as both reply-to and Super Admin email. The API key is valid, but the Resend account currently has no verified sending domain. Resend's sandbox sender is therefore suitable only for development and restricted test delivery.

Before production email:

1. Add an NDCAK-controlled domain in Resend and publish its DNS records.
2. Wait until the domain status is verified.
3. Change `EMAIL_FROM` to an address on that domain, such as `NDCAK Indoor Games <events@example.org>`.
4. Keep `ndcakofficial@gmail.com` as `EMAIL_REPLY_TO` if desired.
5. Send and inspect one registration acknowledgment and one staff invitation before enabling production delivery.

## Supabase Auth SMTP

Supabase Auth SMTP is configured in the Supabase Dashboard, not by the Next.js environment file. Use these values under Authentication email/SMTP settings:

| Setting      | Value                                           |
| ------------ | ----------------------------------------------- |
| Host         | `smtp.resend.com`                               |
| Port         | `465`                                           |
| Username     | `resend`                                        |
| Password     | The Resend API key                              |
| Sender name  | `NDCAK Indoor Games`                            |
| Sender email | A Resend-verified address; sandbox only for dev |

Use TLS/SSL with port 465. Production Auth invitations must not be enabled until the sender domain is verified.

## Delivery rules

- Notification outbox rows are committed with the authoritative database change; sending starts only after commit.
- Email failures are recorded and retried; they do not roll back registration or review transactions.
- Notification idempotency keys prevent duplicate delivery.
- Provider errors and credentials are never returned to the browser.
- Submission email always says pending review and never includes a calendar file.
- Approval email requires configured event start/end times and includes an RFC 5545 `.ics` invitation.
- Rejection email includes only the participant-safe reason entered by the administrator.
- Failed and queued messages can be retried from `/admin/notifications` without repeating the registration decision.
