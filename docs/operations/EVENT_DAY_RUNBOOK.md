# Event day runbook

For the NDCAK committee and whoever keeps the site running. Times are Dhaka
time. The site is https://ndcak-indoor-games.vercel.app.

## Who does what

| Role            | Does                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Super Admin     | Opens and closes registration, verifies payments, makes the draws, resolves problem reports, corrects results |
| Score operators | Enter scores for the matches they are assigned to, and report problems                                        |
| Site keeper     | The person with the project on their computer: backups, emergency access, anything in "If something breaks"   |

## Two weeks before

- Put the committee's real details in **Event settings**: dates, venue,
  check-in instructions, departments and academic years.
- Add every game in **Games** with its fee, capacity and scoring type, and
  publish its rules.
- Replace the placeholder numbers in **Event settings, Payment methods** with
  the real bKash, Nagad and Rocket numbers, and check each one by sending a
  small amount to it yourself.
- Open registration only after the readiness checklist on Event settings is
  all green.
- Run `pnpm readiness:check` on the site keeper's computer. Everything should
  say READY.

## The week before

- Create an account for every score operator in **Operators** and give each
  one their games. Ask them to open the link, set a password and sign in once,
  on the phone they will use on the day.
- Choose the reminder day in **Event settings, Reminders** (for example three
  days before). Confirmed players get one email each.
- Close registration when the deadline passes, then verify every remaining
  payment so no one is left pending.
- Make the draw for each game once its entries are confirmed.
- Take a backup: `pnpm db:backup`, then check it with
  `pnpm db:verify-backup backups/<file>.dump`.
- Visit the site once a day in the week before, so the free database does not
  pause. (The daily job does this by itself; the visit is belt and braces.)

## On the day

Before play starts:

- Open **Dashboard** on a laptop. It shows live matches, operators on duty,
  open problem reports and any email that failed.
- Check that each operator can see their matches on their own phone.
- Keep this page open: it updates by itself.

While matches run:

- Operators enter scores as they play and confirm the result at the end.
- Watch **Problem reports** for anything raised from the floor, and resolve
  each one with a short note so the operator sees it.
- **Matches** shows every match, its score and who last changed it.
- A wrong confirmed result can be reopened from the match page, with a reason.
  The bracket is rebuilt from the corrected result.

Closing:

- Check that every match has a result.
- Turn on **Publish results** in Event settings when the committee is ready
  for the public results page.
- Take a final backup.

## If something breaks

**A phone loses signal.** Nothing is lost. Scores entered while offline sit on
that phone and send themselves when the signal returns. The screen says so.
Do not re-enter the same score on another phone.

**Live updates stop.** Screens show "Reconnecting" and keep working: they
check for changes every few seconds instead. Scoring never depends on live
updates.

**Two people scored the same match.** The server keeps the first result and
tells the second person, showing what is now recorded. If the wrong result was
confirmed, an admin reopens the match and corrects it.

**An operator cannot sign in.** In **Operators**, open the person and send a
fresh invitation. The link sets a new password.

**The Super Admin cannot sign in.** The site keeper runs, from the project
folder:

```bash
pnpm db:invite-admin -- --url https://ndcak-indoor-games.vercel.app
# add --print to show the link instead of emailing it, if email is down
```

This emails a one-time link to the Super Admin address. Adding
`--email person@example.com --name "Full Name"` gives a second trusted person
Super Admin access, which is worth doing before the event.

**Email is not arriving.** Check **Emails**. Anything that failed can be
retried there, and the daily job retries automatically up to three times. If
everything fails, the Gmail App Password has probably been rotated or expired:
put the new one in `.env.local`, run `pnpm vercel:env SMTP_PASSWORD`, then
redeploy with `vercel deploy --prod`.

**The site is down.** Check https://ndcak-indoor-games.vercel.app/api/health.
It answers `{"ok":true}` when the site can reach the database.

- If it answers `{"ok":false}`, the database is unreachable: check the Supabase
  project (it pauses after a week of no activity on the free plan and can be
  resumed from the dashboard).
- If nothing answers, check the Vercel dashboard. The previous deployment can
  be promoted from the Deployments list at any time.

**Scores look wrong on the public page.** Public pages update within a minute
of a confirmed result. Staff pages are always current.

## Backups and recovery

- `pnpm db:backup` writes `backups/ndcak-<date>-<time>.dump` with the row
  counts beside it. The file holds participants' names, emails and phone
  numbers: keep it private and delete old copies after the event.
- `pnpm db:verify-backup backups/<file>.dump` restores it into a throwaway
  local database and checks every table's row count against the backup.
- To restore for real, into a fresh Supabase project:

```bash
pg_restore --list backups/<file>.dump | grep -v " SCHEMA - public " > /tmp/restore.list
pg_restore --no-owner --no-privileges --use-list=/tmp/restore.list \
  --dbname "postgresql://…session-pooler…:5432/postgres" backups/<file>.dump
```

Staff sign-ins live in Supabase Auth, not in the backup. After restoring into
a new project, run `pnpm db:invite-admin` to get the Super Admin back in, then
invite the operators again.

## Where to look

| Question                            | Where                                                     |
| ----------------------------------- | --------------------------------------------------------- |
| Is the site up?                     | `/api/health`                                             |
| What happened to this registration? | Admin, Registrations, open the row                        |
| Who changed this match?             | Admin, Matches, open the match: the log names each person |
| Did the email go out?               | Admin, Emails                                             |
| What did the daily job do?          | Vercel, Logs (`vercel logs <deployment>`)                 |
| What is left to do before launch?   | `pnpm readiness:check`                                    |
