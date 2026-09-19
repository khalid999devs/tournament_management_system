# Phase 3 activation: staff invitations and access rehearsal

This is a live-configuration checklist. Do not paste passwords, database URLs, or API keys into chat, issues, commits, or screenshots. The check command below reports status without printing credential values.

## Current verified state — 19 September 2026

- Local public Supabase connection, database URL, Resend API key, official Admin email, reply-to, and server-only Supabase key are configured. The Auth Admin API accepts the key.
- The official Admin Auth account and active `SUPER_ADMIN` profile exist. A one-time setup email was delivered to `ndcakofficial@gmail.com`; email confirmation and password setup still require the recipient to open it.
- `NEXT_PUBLIC_APP_URL` still points to localhost; `EMAIL_FROM` still uses Resend's sandbox sender. The live database has no tournament, payment method, operator, match, or participant entry.
- The Resend account has no sending domains.

## 1. Secure the credentials already shared

The database password and Resend API key were previously pasted into this conversation. Rotate both in their provider dashboards before production use, then replace their values in ignored `.env.local` and any deployment environment. Percent-encode reserved characters in the database URL password. Do not send the replacements here. The publishable Supabase key is intentionally public; the Supabase secret key is not.

## 2. Verify an NDCAK-controlled sending domain

Deferred until NDCAK has a domain. The sandbox sender successfully delivered the official Admin setup email, but it is not a substitute for a verified domain when inviting other staff or sending production mail.

In [Resend Domains](https://resend.com/domains), add a domain or subdomain that NDCAK owns, for example `updates.example.org` only if NDCAK owns `example.org`. Copy Resend's exact DKIM and SPF records into that domain's DNS, wait for the dashboard to show **Verified**, and add DMARC. Do not use `gmail.com` as the sending domain. The official Gmail address can remain the reply-to inbox.

Set `EMAIL_FROM` in `.env.local` to a sender on the verified domain, for example `NDCAK Indoor Games <events@updates.example.org>`. Keep `EMAIL_REPLY_TO=ndcakofficial@gmail.com` if that is the approved support inbox. The readiness check compares the sender domain with Resend's verified-domain list.

Resend's [domain guide](https://resend.com/docs/add-a-domain) provides DNS-provider-specific instructions and verification troubleshooting.

## 3. Configure Supabase Auth email

Deferred with domain verification. The Admin setup email used the application Resend API and does not depend on Supabase custom SMTP.

In the Supabase project Dashboard, open **Authentication → SMTP Settings** and enable custom SMTP. Use the Resend settings below, with a sender address on the verified domain:

| Setting      | Value                                               |
| ------------ | --------------------------------------------------- |
| Host         | `smtp.resend.com`                                   |
| Port         | `465` (implicit TLS)                                |
| Username     | `resend`                                            |
| Password     | Current Resend API key; enter only in the dashboard |
| Sender name  | `NDCAK Indoor Games`                                |
| Sender email | Address on the verified domain                      |

Supabase's [custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) and Resend's [SMTP guide](https://resend.com/docs/send-with-smtp) describe the current settings. App-managed invitation mail uses the Resend API; Supabase SMTP covers Supabase's own Auth messages, such as password reset.

In **Authentication → URL Configuration**, set the Site URL to the real deployment URL when available and allow the same site for Auth redirects. Keep `http://localhost:3000/**` only for local testing. The app's branded operator invitation uses `NEXT_PUBLIC_APP_URL` directly; an operator on another device cannot open a localhost link from your computer. See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 4. Add the server-only Supabase key

In **Supabase → Project Settings → API Keys**, create or copy a `sb_secret_...` key. Put it only in ignored `.env.local` as `SUPABASE_SECRET_KEY=...`; it must not have a `NEXT_PUBLIC_` prefix. Restart `pnpm dev` after changing the file. For deployment, add it to the hosting provider's encrypted server-side environment settings, not to Git. See [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

## 5. Finish the official Super Admin setup

The official Auth user and app profile were created with the server-only Admin API, and Resend reported the setup email as delivered. The email uses a time-limited link to `/auth/confirm`, followed by `/staff/set-password`. It avoids sending or storing a password. Open it on the same computer running the app, because the current link points to `localhost:3000`.

If the local server is not running, start it before opening the link:

```bash
pnpm dev
```

Set a strong password, then sign in at `http://localhost:3000/staff/login` and verify that `/admin` and `/admin/operators` load. If the link expires, run `pnpm db:invite-admin` to send a fresh one to the configured official inbox. Do not share a password or one-time link in chat. `pnpm phase3:check` will report the Auth user as confirmed after the link is accepted.

## 6. Supply approved event data and rehearse an operator

The app must not invent competition or payment details. Provide the committee-approved tournament name and slug, registration and event dates/times, timezone, venue, maximum games per participant, each game's fee/capacity/rules/scoring format, and each real payment method's recipient/instructions. A non-public test tournament with a game, payment method, round, match, and participant entry is needed to exercise all five assignment scopes and verify that payment information stays hidden from operators. Match creation and scoring UI belong to Phase 4, so scope fixtures must be deliberately prepared before Phase 3 can be signed off.

With a reachable app URL, verified sending domain, and Admin session, use `/admin/operators` to invite one designated test inbox. Check delivery under `/admin/notifications`; the operator should accept the link, set a password, and see an empty `/operator` workspace before assignment. Grant and revoke whole-tournament, game, round, match, and participant-entry scopes in `/admin/operators/[id]`, verifying that only in-scope matches appear and payment data never does. Inspect the authenticated Admin and operator pages at desktop and mobile widths during this rehearsal.

Run `pnpm phase3:check` after each external setup step. It is read-only and does not send email or change database data.
