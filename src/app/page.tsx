import {
  ArrowRight,
  CalendarDays,
  CircleDot,
  Crown,
  Gamepad2,
  MapPin,
  Spade,
  Target,
  Ticket,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { PublicFooter } from "@/components/brand/public-footer";
import { PublicHeader } from "@/components/brand/public-header";
import { Ticker } from "@/components/brand/ticker";
import {
  getPublicEvent,
  isAcceptingRegistrations,
  type PublicEvent,
} from "@/features/tournaments/server/get-registration-tournament";
import { formatDhakaDate, formatDhakaDateRange } from "@/lib/dates";
import { formatBdt } from "@/lib/money";

// Keeps "19 October 2026" or "Mobile Football" together on one line.
const keepTogether = (text: string) => text.replace(/ /g, "\u00a0");

export const revalidate = 60;

// Shown only until the committee publishes the configured lineup.
const announcedLineup = [
  { name: "Chess", description: "Classical strategy over the board." },
  { name: "Table Tennis", description: "Fast rallies and sharp finishes." },
  { name: "Carrom", description: "Touch, angles and nerve." },
  { name: "Mobile Football", description: "Head-to-head on the pitch." },
  { name: "29 Cards", description: "Read the table, win the hand." },
];

const gameIcons: [RegExp, LucideIcon][] = [
  [/chess/i, Crown],
  [/table\s*tennis|ping/i, CircleDot],
  [/carrom/i, Target],
  [/card|29/i, Spade],
  [/football|fifa|pes|mobile/i, Gamepad2],
];

function iconFor(name: string) {
  return gameIcons.find(([pattern]) => pattern.test(name))?.[1] ?? Trophy;
}

async function loadEvent() {
  try {
    return await getPublicEvent();
  } catch {
    // The home page must stay up even when the database is unreachable.
    return null;
  }
}

function describeRegistration(event: PublicEvent | null) {
  if (!event) return { open: false, label: "Registration opens soon" };
  if (
    event.status === "REGISTRATION_OPEN" &&
    event.registrationOpenAt &&
    new Date(event.registrationOpenAt) > new Date()
  ) {
    return {
      open: false,
      label: `Registration opens ${keepTogether(formatDhakaDate(event.registrationOpenAt))}`,
    };
  }
  if (!isAcceptingRegistrations(event)) {
    return { open: false, label: "Registration has closed" };
  }

  return {
    open: true,
    label: event.registrationCloseAt
      ? `Registration open until ${keepTogether(formatDhakaDate(event.registrationCloseAt))}`
      : "Registration is open",
  };
}

export default async function Home() {
  const event = await loadEvent();
  const registration = describeRegistration(event);
  const lineup = event?.games.length
    ? event.games.map((game) => ({
        id: game.id as string | null,
        open: game.registrationOpen,
        name: game.name,
        description: game.description,
        fee: formatBdt(game.feeMinor),
        slotsLeft: Math.max(
          0,
          game.capacity - game.reservedCount - game.confirmedCount,
        ),
      }))
    : announcedLineup.map((game) => ({
        ...game,
        id: null,
        open: false,
        fee: null,
        slotsLeft: null,
      }));
  const eventName = event?.name ?? "NDCAK Indoor Games Championship";
  const dates = event?.startsAt
    ? formatDhakaDateRange(event.startsAt, event.endsAt)
    : "To be announced";
  const venue = event?.venue ?? "KUET Campus, Khulna";
  const tickerItems = [
    eventName,
    registration.label,
    ...lineup.map((game) => game.name),
    venue,
  ];

  return (
    <>
      <div className="home-header">
        <PublicHeader />
      </div>
      <main id="main-content">
        <section className="hero-shell">
          <Ticker items={tickerItems} />

          <div className="hero-grid page-width">
            <div className="hero-copy">
              <p className="eyebrow">
                Notre Dame College Association of KUET presents
              </p>
              <h1>
                Indoor Games
                <span>Championship.</span>
              </h1>
              <p className="hero-intro">
                {event?.description ??
                  `${lineup.length} games. One championship. From the chessboard to the carrom board, take on the best players at KUET and play for the title.`}
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/register">
                  {registration.open ? "Register now" : "Registration details"}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link className="button button-quiet" href="/rulebook">
                  Read the rulebook
                </Link>
              </div>
            </div>

            <dl className="event-facts" aria-label="Event essentials">
              <div>
                <dt>
                  <CalendarDays size={18} aria-hidden="true" /> Dates
                </dt>
                <dd>{dates}</dd>
              </div>
              <div>
                <dt>
                  <MapPin size={18} aria-hidden="true" /> Venue
                </dt>
                <dd>{venue}</dd>
              </div>
              <div>
                <dt>
                  <Ticket size={18} aria-hidden="true" /> Entry
                </dt>
                <dd>
                  <span
                    className={
                      registration.open ? "status-dot live" : "status-dot"
                    }
                    aria-hidden="true"
                  />
                  {registration.label}
                </dd>
              </div>
              <div>
                <dt>
                  <Trophy size={18} aria-hidden="true" /> Games
                </dt>
                <dd>
                  {lineup.map((game) => keepTogether(game.name)).join(" · ")}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="lineup-section page-width" aria-labelledby="lineup">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The lineup</p>
              <h2 id="lineup">Pick your games.</h2>
            </div>
            <p>
              Enter one game or several in a single registration. Each game is
              its own competition, so you can chase more than one title.
            </p>
          </div>

          <ul className="lineup-grid">
            {lineup.map((game) => {
              const Icon = iconFor(game.name);
              const full = game.slotsLeft === 0;
              const canEnter = Boolean(
                game.id && game.open && registration.open && !full,
              );

              return (
                <li key={game.name}>
                  <Link
                    className={
                      canEnter ? "lineup-card" : "lineup-card is-closed"
                    }
                    href={canEnter ? `/register?game=${game.id}` : "/register"}
                    aria-label={`${game.name}: ${canEnter ? "register" : "registration details"}`}
                  >
                    <Icon size={26} aria-hidden="true" />
                    <h3>{game.name}</h3>
                    <p>{game.description}</p>
                    <div className="lineup-meta">
                      <div>
                        {game.fee ? (
                          <>
                            <strong>{game.fee}</strong>
                            <span>
                              {full
                                ? "Full"
                                : !game.open && game.id
                                  ? "Closed"
                                  : `${game.slotsLeft} places left`}
                            </span>
                          </>
                        ) : (
                          <span>Fee and places announced soon</span>
                        )}
                      </div>
                      {canEnter ? (
                        <span className="lineup-go" aria-hidden="true">
                          <ArrowRight size={18} />
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="entry-section" aria-labelledby="how-to-enter">
          <div className="page-width entry-grid">
            <div>
              <p className="eyebrow">How to enter</p>
              <h2 id="how-to-enter">Three steps to the draw.</h2>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Choose your games</strong>
                  <p>
                    Fill in your details and select every game you want to play.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Pay the entry fee</strong>
                  <p>
                    Send the total by mobile banking and submit your transaction
                    ID.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Get confirmed</strong>
                  <p>
                    Once the committee verifies your payment, your confirmation
                    and calendar invite arrive by email.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="closing-cta page-width">
          <div>
            <p className="eyebrow">{registration.label}</p>
            <h2>Your seat at the table is waiting.</h2>
          </div>
          <Link className="button button-primary" href="/register">
            {registration.open ? "Claim your spot" : "See registration details"}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
