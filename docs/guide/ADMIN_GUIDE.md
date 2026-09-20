# Admin handbook

Everything in the admin panel, section by section, in the order it appears in
the menu. Written for the committee. For the day itself, keep the
[event day runbook](../operations/EVENT_DAY_RUNBOOK.md) open instead.

Sign in at `/staff/login`. Only a Super Admin sees these pages; a score
operator who opens them is sent back to their own match list.

| Menu item           | What it is for                                       |
| ------------------- | ---------------------------------------------------- |
| **Dashboard**       | The one screen to watch on the day                   |
| **Event**           | Dates, venue, registration window, payment numbers   |
| **Games**           | The lineup, fees, capacity, rules, scoring and draws |
| **Matches**         | Every match, its score, corrections                  |
| **Problem reports** | What operators flag from the floor                   |
| **Registrations**   | The payment verification queue                       |
| **Reports**         | Five CSV exports                                     |
| **Notifications**   | Every email and whether it arrived                   |
| **Operators**       | Who scores which games                               |

Times are Bangladesh time everywhere. Money is shown in BDT.

**Every complicated screen has its own guide.** Look for a button in the top
right of the panel: _How scoring works_, _How the draw works_, _How access
works_, _How to fix a result_, _How to set up_. Each opens a short illustrated
explanation without leaving the page. Score operators have one too, on their
scoring screen.

---

## Dashboard

Counted fresh from the database each time you open it, and it updates by
itself while open. A small badge reads **Live**, or **Reconnecting** when the
connection drops, in which case the page refreshes every 30 seconds instead.

What it shows:

- **Registrations** — pending review, confirmed, rejected, total, plus fees
  verified and awaiting review, confirmed game entries and open problem
  reports.
- **Matches** — live now, scheduled, finished, postponed or cancelled, with a
  line underneath naming how many operators are on duty and how many people
  entered a score in the last 30 minutes.
- **Capacity by game** — confirmed, pending and places left for each game.
- **Open problem reports** — the five newest.
- **Recent score activity** — the last eight changes, with who made each one.

Before the event is ready, a setup panel at the top counts the steps still
missing and links to Event settings. If any email has failed, a banner says so
and links straight to it.

Nothing on this page changes anything. It is safe to leave open on a laptop
all day.

---

## Event

### Creating the tournament

The first time, you give a name and a year. It stays a **draft**, invisible to
the public, until you open registration. Only one live tournament exists at a
time; archiving the old one starts the next.

### The status bar

| Status                  | What it means                                          |
| ----------------------- | ------------------------------------------------------ |
| **Draft**               | Staff only. Nothing public.                            |
| **Registration open**   | Students can register for games that are open.         |
| **Registration closed** | No new entries. Pending payments can still be decided. |
| **In progress**         | The event is running.                                  |
| **Completed**           | Finished. Archive it to start a new one.               |
| **Archived**            | Kept for history only.                                 |

The buttons only offer moves that make sense from where you are. **Archive
event** is a one-way door: there is no way back out of Archived.

### The readiness checklist

While the event is in draft or registration is closed, a checklist shows what
is still missing. **Open registration** stays disabled until the required
items pass, and the server checks again when you press it, so registration can
never open with a vital detail missing.

Required: event start and end times, venue, a registration closing time still
in the future, at least one game open, and an enabled payment method if any
open game has a fee. Recommended but not blocking: check-in instructions for
the confirmation email.

### Event details

Name, year, venue and a short description for the home page. Dates for when
the event starts and ends, and when registration opens and closes. The start
and end go into every confirmation email as a calendar invite, which is why
approval is blocked until they are set.

Also here: the most games one person may enter, whether results are published
publicly, and the lists of **departments** and **academic years** students
pick from. Those lists are checked on the server, so nothing outside them can
be submitted.

**Check-in instructions** go into every confirmation email. Write them for
participants; never put internal notes there.

While registration is open you cannot blank out the venue, the dates or the
closing time.

### Payment methods

Each method has a name students see (bKash, Nagad, Rocket), the receiving
number, instructions, a display order and an on/off switch.

Two things worth knowing:

- **Every registration keeps a copy of the account it was shown.** Editing a
  number later never changes what a past registration recorded, so your
  records stay honest.
- **There is no delete.** Disable a method instead, and it disappears from the
  registration form while its history stays intact.

Check each number by sending a small amount to it yourself before you open
registration.

### Reminder email

Choose how many days before the event confirmed players get a reminder: 1, 2,
3, 7, or off. The daily job sends them, and the panel shows how many are
confirmed, sent, waiting and failed.

**Send the reminder now** sends immediately instead, to every confirmed player
who has not had one. Each player gets it once, so pressing it twice is safe.
Emails cannot be recalled once sent.

---

## Games

Each game has a fee, a capacity, a scoring type and its own rules, and lives
in one of three states: **Draft** (hidden), **Open** (on the registration
form) or **Closed** (visible but not accepting).

Add a game and it starts as a draft. Open it when you are ready.

### Game settings

Fee changes apply only to new registrations; anyone who already registered
keeps the fee they were quoted. Capacity cannot be lowered below the places
already taken. The rules text you write is published on the public rulebook.

### Scoring rules

Pick the scoring type for the game and its settings. The seven types:

| Type                         | For                                             | Players per match |
| ---------------------------- | ----------------------------------------------- | ----------------- |
| Win / draw / loss            | Chess, Ludo 1v1, most board games               | 2                 |
| Boards and points            | Carrom, darts legs, pool frames                 | 2                 |
| Goals                        | eFootball, FIFA, foosball, hockey               | 2                 |
| Best-of sets                 | Table tennis, badminton, volleyball, squash     | 2                 |
| Multi-player points          | 29 Cards, Ludo with four, Uno, quiz rounds      | 2 to 16           |
| Placement points             | PUBG Mobile, Free Fire, racing, battle royale   | 2 to 100          |
| Highest or lowest score wins | Scrabble, cube times, typing speed, quiz totals | 2 to 64           |

**Progression** is either **knockout**, where winners advance automatically,
or **manual rounds**, where you build each round and choose who plays.
Knockout is head to head, so anything with three or more players in a match
uses manual rounds.

**A whole lobby in one match.** For thirty players racing or fighting at once,
set manual rounds and put everyone in a single match. Use **placement points**
if you rank the finishers, or **highest or lowest score wins** if you record
each player's time. Two things to know: the operator must record a finishing
position or value for **every** player before the result can be confirmed, and
nothing stops the match automatically when the leader finishes. Only
multi-player points has an optional target that ends a game, and it caps at
sixteen players.

Scoring rules **lock once the first match in that game starts**, so every
result in a game is judged by the same rules. Set them before you draw.

### The draw

For a knockout game, three things must be true before you can draw: the game
is closed to registration, every payment in it has been approved or rejected,
and at least two players are confirmed. The page names whichever is missing.

Choose a **random draw** (the default) or paste registration codes in seeded
order. Top seeds get byes when the field is not a power of two, and winners
move on by themselves.

For a manual game you add each round, then create its matches by ticking who
plays. The number of players you tick has to suit the scoring type.

**Reset the draw** deletes every match in it. You must type RESET, it only
works before any match has started, and it refuses while operators are
assigned to those rounds or matches.

### Removing a game

Only possible while it has no registrations. Once anyone has entered, the game
stays for the record and you close it instead.

---

## Matches

Every match in one list, with search by code, player or registration code, and
filters by game and status. 25 to a page. **Export CSV** downloads whatever
the current filters show. Applying a filter refreshes only the list, so the
page does not reload under you.

**Edit** on any row opens the common changes in place, without opening the
match:

- **Start time** and **table or station**, which never touch the score.
- **Postpone**, with a reason, for a match that is scheduled or being played.
- **Resume**, for one that was postponed.

You are returned to the same page of the same filtered list. Reopening a
confirmed result and cancelling a match are still only on the match's own
page, because they change what operators see and need a reason on the
record.

Opening a match gives you the same scoring screen an operator sees, plus
**admin controls** down the right:

- **Reopen result** — for a finished match, so the score can be corrected and
  confirmed again. Needs a reason of at least 5 characters, which is kept in
  the audit log. If the winner has already moved on, they are withdrawn from
  the next match, which only works while that match has not started. If it
  has, reopen that one first.
- **Postpone** — stops scoring, keeps the score and players. Needs a reason.
- **Resume match** — puts a postponed match back in play.
- **Time and place** — start time, table or station, venue. Never touches the
  score.
- **Cancel match** — manual games only, and the history is kept. Needs a
  reason.

The **match log** lists every action in the order it was saved, with who did
it, the version number, and the time the button was pressed when a phone's
clock differed from the server's.

---

## Problem reports

Operators flag problems from any match: a no-show, a disputed score, a broken
table, player conduct, a timing issue, or something else. Reports arrive here
within a second or two, and the menu shows a count of open ones.

Three tabs: **Open**, **Resolved**, **All**. Each report shows what kind it
is, what was written, which match it came from and who reported it.

Resolving one records who handled it and an optional note, which the operator
then sees on their own screen. **Resolution is one-way** — there is no way to
un-resolve, so write the note before you press it.

---

## Registrations

The verification queue. Search matches a registration code, name, student ID,
email, phone or transaction ID. Filter by status, game, department, payment
method and date range, and sort by newest, oldest or name. 25 to a page.
**Export CSV** carries whatever filters you have set.

Applying a filter, with the button or by pressing Enter, refreshes only the
list. The page does not reload, so the boxes keep what you typed and you stay
where you were. This is the same on Matches and Notifications.

Opening one shows the participant's details, the payment evidence (method,
receiving account, expected amount, transaction ID) and the games they picked.

**Check the transaction ID against your bKash, Nagad or Rocket statement
before deciding.** The platform records what the student typed; it cannot
verify a payment for you.

Then record a decision:

- **Approve registration** — confirms every game they picked, marks the
  payment verified, moves their place from held to confirmed, and emails them
  a confirmation with a calendar invite. Blocked until the event start and end
  times are set, because the invite would otherwise be wrong.
- **Reject and release slots** — needs a reason, which is **emailed to the
  student**, so write it for them to read. Their places are released for
  someone else straight away.

**Neither can be undone.** There is no re-open, and a second attempt tells you
another review already finished it. Double-clicking is safe: the decision
applies once.

---

## Reports

Five CSV files. Each holds every row matching its filters, not just the page
you can see. Files are named `ndcak-<kind>-<date>.csv` and open cleanly in
Excel, including Bengali names.

| Export                        | One row per                | Use it for                     |
| ----------------------------- | -------------------------- | ------------------------------ |
| **Registrations**             | registration               | The full record with contacts  |
| **Confirmed players by game** | confirmed player, per game | Check-in sheets                |
| **Payment verification**      | payment                    | Matching the banking statement |
| **Match results**             | match                      | Results and placings           |
| **Operator activity**         | score change               | Who entered what, and when     |

**Every download is recorded in the audit log**, because these files contain
participants' names, emails and phone numbers. Treat them as confidential and
delete old copies after the event.

---

## Notifications

Every email the platform has tried to send: registration received, confirmed,
not confirmed, event reminder and operator invitation. Filter by recipient,
status, type and date.

Status reads **Waiting**, **Sending**, **Sent** or **Failed**. Anything failed
or waiting has a **Retry** button, which re-sends the same email and never
changes the registration behind it. The daily job also retries failures up to
three times by itself.

If everything is failing, the Gmail App Password has usually expired. The
runbook explains how to replace it.

---

## Operators

### Inviting

Enter a name and email and press **Send invitation**. That creates the staff
account and emails a one-time link; the operator chooses their own password.
You never set or see it. Delivery shows under Notifications.

An invitation on its own gives access to nothing.

### Handing over games

Each operator in the list has a row of **game chips**. Tap a game to hand it
over, tap again to take it back. An operator can hold as many games as you
like.

Giving a game this way grants the full scoring level: they can enter scores,
confirm results and report problems for **every match in that game**,
including matches the draw creates later. This is the normal way to set up
your team, and for most events it is the only thing you need to do here.

### Narrowing access

**Details** opens one operator's page, for the cases a whole game is too
broad. The form there is three steps: what they cover, which one, and what
they can do.

What they cover:

- **Whole tournament** — every game
- **One game**
- **One round**
- **One match**
- **Players** — every match those players are in

Rounds and matches only appear in the list once you have made the draw for a
game, because they do not exist before that.

Choosing **Players** gives you a search box rather than a list. Type a name,
student ID or registration code and tick as many people as you like. There is
**one row per person**, not one per game, and ticking someone covers every
game they entered. The list is only fetched when you open it, so an event with
hundreds of entrants does not slow the page down.

And what they can do:

| Level                         | Can                                        |
| ----------------------------- | ------------------------------------------ |
| **Score and confirm results** | Enter scores and confirm the final result  |
| **Score only**                | Enter scores; an admin confirms the result |
| **Watch only**                | Follow the matches, change nothing         |

Every level can report a problem.

### How access adds up

Assignments are additive: an operator can do anything at least one assignment
allows, and nothing else. Giving the same thing twice does not stack; it
replaces what was there, and re-giving something you removed brings it back.
Where a narrower assignment is already covered by whole-tournament access, the
page says so.

Removing an assignment takes effect on the operator's next page load.

**Deactivating an operator also removes every assignment they hold**, and
reactivating does not bring them back. You give the games again.

Operators never see payment details anywhere.
