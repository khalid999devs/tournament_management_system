# How the platform works

Written for the NDCAK committee and anyone helping run the championship. No
technical background needed. The site is
https://ndcak-indoor-games.vercel.app.

- [Admin handbook](ADMIN_GUIDE.md) — every section of the admin panel.
- [Operator handbook](OPERATOR_GUIDE.md) — score operators, from invitation to
  the final result.
- [What students see](PARTICIPANT_JOURNEY.md) — registration, payment and the
  emails they get.
- [Event day runbook](../operations/EVENT_DAY_RUNBOOK.md) — the checklist for
  the day itself, including what to do when something breaks.

## The three kinds of people

| Who                | Needs an account? | What they do                                                        |
| ------------------ | ----------------- | ------------------------------------------------------------------- |
| **Students**       | No                | Register, pick games, pay once, wait for confirmation               |
| **Super Admin**    | Yes               | Sets up the event, verifies payments, makes draws, fixes problems   |
| **Score operator** | Yes               | Enters scores for the matches they were given, and reports problems |

There are only two staff roles. A Super Admin can do everything. A score
operator can only reach the matches an admin handed them, and never sees
anyone's payment details.

## The shape of an event

```
Set up the event  →  Open registration  →  Verify payments  →  Close registration
        →  Make the draws  →  Assign operators  →  Play and score  →  Publish results
```

1. **Set up.** Enter the dates, venue, payment numbers, departments and the
   list of games with their fees and capacities. Nothing is visible to the
   public while the event is in draft.
2. **Open registration.** A readiness checklist has to pass first, so the site
   can never take a registration while a vital detail is missing.
3. **Students register.** They fill in their details, pick games, pay the total
   by bKash, Nagad or Rocket, and enter the transaction ID. Their place is
   held while you check the payment.
4. **Verify payments.** Each registration waits in a queue. Approving confirms
   every game they picked and sends a confirmation email with a calendar
   invite. Rejecting releases their places for someone else and emails them
   the reason.
5. **Close registration and draw.** Once a game is closed and every payment in
   it is decided, you make its draw. The platform builds the bracket, gives
   byes to top seeds when the numbers do not divide evenly, and moves winners
   on by itself.
6. **Assign operators.** Invite them by email and tick the games each one will
   score.
7. **Play.** Operators score from their phones. You watch the dashboard, which
   updates by itself, and resolve any problem reported from the floor.
8. **Publish.** Turn on published results when the committee is ready, and the
   public results page fills in.

## Things worth knowing before you start

**Nothing is invented.** Dates, fees, capacities, rules, payment numbers and
the game list are all settings you enter. The site never shows a made-up
value; where something is not set yet, it says so.

**Money is never moved by the platform.** Students pay by mobile banking the
way they always have. The platform records what they say they paid and gives
you the transaction ID to check against your bKash, Nagad or Rocket statement.
The totals on screen are what people were asked to pay, not an accounting
record.

**Every important action is written down.** Approvals, rejections, score
changes, corrections, exports and access changes all go into an audit log with
who did it and when. Score changes are also shown in each match's own log.

**Two people cannot overwrite each other.** If two operators score the same
match, the server keeps the first result and tells the second person what is
actually recorded. Nothing is silently lost.

**Phones can lose signal.** Scores entered while offline sit on that phone and
send themselves when the connection returns. The screen says so plainly. Do
not re-enter the same score somewhere else.

**Staff screens update themselves.** The dashboard, match monitor,
registration list and problem reports refresh within about a second of a
change. If that connection drops, they say "Reconnecting" and keep working by
checking every few seconds instead.

## Signing in

Staff sign in at `/staff/login` with their email and password. A Super Admin
lands in the admin panel, an operator lands in their match list, and neither
can reach the other's pages.

Nobody sets a password for anyone else. Invitations and password resets send a
one-time link, and the person chooses their own password.

If the Super Admin is locked out, the person with the project on their
computer can generate a fresh link. That is in the
[event day runbook](../operations/EVENT_DAY_RUNBOOK.md).
