# What students see

The participant side, so the committee knows exactly what it is asking people
to do and what to say when someone calls.

Students never make an account and never set a password.

---

## The public pages

| Page           | What is on it                                                               |
| -------------- | --------------------------------------------------------------------------- |
| **Home**       | The dates, venue, entry status and the game cards with fees and places left |
| **Schedule**   | Fixtures by day, once the draw is made                                      |
| **Rulebook**   | Eligibility, fair play, reporting and disputes, then each game's own rules  |
| **Results**    | Confirmed results and brackets, once the committee publishes them           |
| **Developers** | Who built the platform                                                      |

Before there is anything to show, each page says so plainly. The schedule says
the draw has not been made; results say they are not published yet. No page
ever invents a date, a fee or a fixture.

---

## Registering, in three steps

A progress line reads **Step 1 of 3 · Details** and so on. Answers are kept on
the student's own device, so going back or reloading loses nothing.

### 1. Details

Full name, student ID, academic year, department, email and phone.

- Department and academic year are picked from the lists you configured, and
  checked again on the server.
- The phone must be a Bangladesh mobile number. `01XXXXXXXXX` is fine; it is
  stored as `+880…`.

Then they pick their games. Each card shows the fee, a short description and
the places left, with **Only n places left** below five and **Full** at zero.
Games that are full or closed cannot be picked. A counter shows how many of
the allowed maximum they have chosen.

A running summary shows the games and the total, and says plainly: _Nothing is
submitted yet._

### 2. Review

Their details and games in full, each with an edit link, and the total to pay.
Still nothing submitted.

If a game filled up or closed while they were deciding, this screen says so
and sends them back to change games. Their details are kept.

### 3. Pay and submit

They choose a payment method, and the page shows the exact total and the
receiving number with a **Copy** button, plus whatever instructions you wrote
for that method.

Then they enter the **transaction ID** from their confirmation SMS and press
**Submit registration**.

Submitting twice is safe: the same registration comes back rather than a
second one being created.

### The receipt

**You are almost in.** Their registration code is shown, and they are told to
keep it for check-in. Their place is held while the committee checks the
payment.

---

## Why a registration can be refused

These are the messages students see, and what each one means for you when they
ring up:

| Message                                                                | What happened                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| _This student already has an active registration for the event._       | They registered before. One active entry per student.  |
| _This transaction ID has already been used for this payment provider._ | The ID is already on another registration. Check both. |
| _A selected game filled up before submission._                         | Someone took the last place first.                     |
| _Registration is not open for this event._                             | The window is closed or not yet open.                  |
| _Too many registrations have come from your network…_                  | Many entries from one connection. It clears in 10 min. |

The last one matters at the venue: if a queue of students registers from one
phone hotspot, they may hit it. Space them out or use different connections.

---

## The emails

| Email                          | When                                                | What it carries                                                               |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Registration received**      | Straight after they submit                          | Their code and games, and that it is not confirmed yet                        |
| **Registration confirmed**     | When you approve the payment                        | Their code, games, dates, venue, check-in instructions, and a calendar invite |
| **Registration not confirmed** | When you reject                                     | Your reason, word for word                                                    |
| **Event reminder**             | The number of days before you chose, if switched on | Their code, games, when and where                                             |

Two things to be careful with, because students read them:

- **The rejection reason is emailed as you typed it.** Write it for them.
- **The check-in instructions go into every confirmation.** Keep internal
  notes out of that field.

Delivery for every one of these is visible under **Notifications** in the
admin panel, and anything that failed can be retried there.

---

## Privacy

Registrations hold names, student IDs, emails and phone numbers. Score
operators never see any of it, nor any payment detail. CSV exports do contain
it, every download is logged, and old copies should be deleted after the
event.
