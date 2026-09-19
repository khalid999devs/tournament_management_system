# Email Integration

## Application email

The application uses the official Resend SDK from server-only code in `src/lib/email/resend.ts`. A shared React Email layout follows the navy, gold, ivory, and green NDCAK design system. It renders both HTML and plain text.

Implemented states:

| State                                  | Delivery                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| Registration received / pending review | Wired to the registration outbox                         |
| Registration confirmed                 | Wired to approval; includes a calendar invitation        |
| Registration rejected                  | Wired to rejection; includes the participant-safe reason |
| Operator invitation                    | Wired to the staff invitation outbox and retry flow      |
| Event reminder                         | Template ready; job scheduling belongs to Phase 5        |
| Schedule change                        | Template ready; event-change dispatch belongs to Phase 5 |
| Support acknowledgment                 | Template ready; support intake is not built yet          |

Preview every state locally at `/dev/email-preview`. The preview contains fictional details, never sends email, and returns 404 outside development. Do not use its dates or links as event configuration.

Run `pnpm test:e2e` after installing Playwright Chromium to check all seven states at desktop and mobile widths. The checks cover full email height, visible support footer, and horizontal overflow; the preview does not send messages.

Environment contract:

- `RESEND_API_KEY` - secret API key; never client-exposed or committed.
- `EMAIL_FROM` - verified sender identity.
- `EMAIL_REPLY_TO` - organizer inbox for participant replies.
- `SUPER_ADMIN_EMAIL` - initial Super Admin identity; not a delivery credential.

Current development configuration uses `onboarding@resend.dev` as the sender and `ndcakofficial@gmail.com` as both reply-to and Super Admin email. The API key is valid, but the Resend account currently has no verified sending domain. Resend's sandbox sender is therefore suitable only for development and restricted test delivery.

The official Admin setup email was sent through this sandbox sender, and Resend reports it as delivered. `pnpm db:invite-admin` can issue a fresh time-limited setup link if needed; it sends only to `SUPER_ADMIN_EMAIL` and requires a local server when `NEXT_PUBLIC_APP_URL` is localhost. Separate operator invitations still need a verified sending domain for reliable delivery to their own addresses.

Before production email:

1. Add an NDCAK-controlled domain in Resend and publish its DNS records.
2. Wait until the domain status is verified.
3. Change `EMAIL_FROM` to an address on that domain, such as `NDCAK Indoor Games <events@example.org>`.
4. Keep `ndcakofficial@gmail.com` as `EMAIL_REPLY_TO` if desired.
5. Send and inspect one registration acknowledgment and one staff invitation before enabling production delivery.

## Supabase Auth SMTP

Application-managed operator invitations use Supabase Auth link generation and the branded Resend template. Other Supabase Auth emails still require SMTP configured in the Supabase Dashboard, not in the Next.js environment file. Use these values under Authentication email/SMTP settings:

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
- Notification idempotency keys reduce duplicate delivery within the provider's retention window; database status remains the authoritative retry gate.
- Provider errors and credentials are never returned to the browser.
- Submission email always says pending review and never includes a calendar file.
- Approval email requires configured event start/end times and includes an RFC 5545 `.ics` invitation.
- Rejection email includes only the participant-safe reason entered by the administrator.
- Failed and queued messages can be retried from `/admin/notifications` without repeating the registration decision.
- Operator invitations are created only by a Super Admin. A Supabase invite link is generated immediately before email delivery; retry generates a fresh time-limited link. The link opens `/staff/set-password` after verification.
- App emails contain no payment transaction ID, receiving account, or internal review note.
