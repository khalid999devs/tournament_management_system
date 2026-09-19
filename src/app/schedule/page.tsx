import { CalendarClock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPageShell,
  publicInformationStyles as styles,
} from "@/components/brand/public-page-shell";
import schedule from "@/features/matches/components/public-schedule.module.css";
import { getPublicResults } from "@/features/matches/server/public-results";
import { getPublicEvent } from "@/features/tournaments/server/get-registration-tournament";
import { formatDhakaDateRange } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Schedule",
  description: "NDCAK Indoor Games Championship fixtures and match days.",
};

export const revalidate = 60;

const dhakaDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dhakaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

type Fixture = {
  code: string;
  status: string;
  scheduledAt: string | null;
  station: string | null;
  game: string;
  round: string;
  players: string[];
};

function groupByDay(fixtures: Fixture[]) {
  const groups = new Map<string, Fixture[]>();
  const sorted = [...fixtures].sort((a, b) =>
    (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999"),
  );
  for (const fixture of sorted) {
    const day = fixture.scheduledAt
      ? dhakaDay.format(new Date(fixture.scheduledAt))
      : "Time to be announced";
    groups.set(day, [...(groups.get(day) ?? []), fixture]);
  }
  return [...groups.entries()];
}

export default async function SchedulePage() {
  const [event, results] = await Promise.all([
    getPublicEvent().catch(() => null),
    getPublicResults().catch(() => null),
  ]);

  const fixtures: Fixture[] = results?.enabled
    ? results.games.flatMap((game) =>
        game.rounds.flatMap((round) =>
          round.matches
            .filter(
              (match) =>
                !["COMPLETED", "WALKOVER", "CANCELLED"].includes(match.status),
            )
            .map((match) => ({
              code: match.code,
              status: match.status,
              scheduledAt: match.scheduledAt,
              station: match.station,
              game: game.name,
              round: round.name,
              players: match.entrants.map((entrant) => entrant.name),
            })),
        ),
      )
    : [];
  const drawPublished = Boolean(results?.enabled && results.games.length);

  return (
    <PublicPageShell
      eyebrow="Match days"
      title="Schedule."
      intro="Fixtures for every game, with times and tables, are published here once the draw is made."
    >
      <div className={styles.informationGrid}>
        {fixtures.length ? (
          <div className={schedule.days}>
            {groupByDay(fixtures).map(([day, list]) => (
              <section key={day} className={schedule.day} aria-label={day}>
                <h2>{day}</h2>
                <ol>
                  {list.map((fixture) => (
                    <li key={`${fixture.game}-${fixture.code}`}>
                      <span className={schedule.time}>
                        {fixture.status === "IN_PROGRESS"
                          ? "Live"
                          : fixture.scheduledAt
                            ? dhakaTime.format(new Date(fixture.scheduledAt))
                            : "TBA"}
                      </span>
                      <span className={schedule.match}>
                        <strong>
                          {fixture.players.length
                            ? fixture.players.map((name, index) => (
                                <span key={`${name}-${index}`}>
                                  {index > 0 ? " vs " : ""}
                                  <span className={schedule.nowrap}>
                                    {name}
                                  </span>
                                </span>
                              ))
                            : "Players to be decided"}
                          {fixture.players.length === 1
                            ? " vs to be decided"
                            : ""}
                        </strong>
                        <small>
                          {[
                            fixture.game,
                            fixture.round,
                            fixture.code,
                            fixture.station,
                            fixture.status === "POSTPONED" ? "Postponed" : null,
                          ]
                            .filter(Boolean)
                            .map((item, index) => (
                              <span key={index}>
                                {index > 0 ? " · " : ""}
                                <span className={schedule.nowrap}>{item}</span>
                              </span>
                            ))}
                        </small>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <section className={styles.empty}>
            <div>
              <CalendarClock size={42} aria-hidden="true" />
              <h2>
                {drawPublished
                  ? "All matches are played"
                  : "The draw has not been made yet"}
              </h2>
              <p>
                {drawPublished
                  ? "Every published match has a result. See the brackets and final placings on the results page."
                  : "Fixtures are drawn after registration closes. Confirmed players also receive the event dates and check-in details by email."}
              </p>
              <Link href={drawPublished ? "/results" : "/register"}>
                {drawPublished ? "See results" : "Registration details"}
              </Link>
            </div>
          </section>
        )}
        <aside className={styles.sideCard}>
          <MapPin size={22} aria-hidden="true" />
          <p>Event details</p>
          <dl>
            <div>
              <dt>Venue</dt>
              <dd>{event?.venue ?? "KUET Campus, Khulna"}</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                {event?.startsAt
                  ? formatDhakaDateRange(event.startsAt, event.endsAt)
                  : "To be announced"}
              </dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>
                {event?.checkInInstructions ??
                  "Shared with confirmed players by email."}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </PublicPageShell>
  );
}
