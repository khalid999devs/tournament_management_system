# Deployment on Vercel

The platform runs on Vercel's free `*.vercel.app` address. No custom domain is needed: links in emails and page metadata use the Vercel production address automatically, and email goes out through Gmail SMTP.

## Settings

- **Region:** `vercel.json` pins functions to `bom1` (Mumbai), next to the Supabase database in `ap-south-1`. Other regions add a long round trip to every query.
- **Database:** use the Supabase Transaction Pooler URL (port 6543) as `DATABASE_URL`. It suits serverless functions.
- **App URL:** leave `NEXT_PUBLIC_APP_URL` unset on Vercel. The app uses `VERCEL_PROJECT_PRODUCTION_URL` in production and the deployment's own URL in previews. Set it only after adding a custom domain.

## Environment variables (Production)

| Variable                               | Value                                                  |
| -------------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`                         | Supabase Transaction Pooler URL                        |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key                               |
| `SUPABASE_SECRET_KEY`                  | Supabase server-only secret key                        |
| `SUPER_ADMIN_EMAIL`                    | `ndcakofficial@gmail.com`                              |
| `SMTP_USER`                            | `ndcakofficial@gmail.com`                              |
| `SMTP_PASSWORD`                        | Google App Password (see `docs/integrations/EMAIL.md`) |
| `EMAIL_REPLY_TO`                       | `ndcakofficial@gmail.com`                              |

Preview deployments should not use the production database. Until a separate Supabase project exists for previews, deploy production only.

## First deployment

1. `vercel login` with the account that should own the project.
2. `vercel link` in the repository root and create the project.
3. Add the variables above with `vercel env add <NAME> production`.
4. `vercel deploy --prod`.
5. In Supabase → Authentication → URL Configuration, set **Site URL** to the `https://….vercel.app` address and add `https://….vercel.app/**` to **Redirect URLs**. Keep `http://localhost:3000/**` for local work.
6. Sign in at `/staff/login`, invite a test operator to a second inbox, and confirm the email arrives and its link opens on another device.

Connecting the GitHub repository in the Vercel dashboard makes every push to `main` deploy automatically.
