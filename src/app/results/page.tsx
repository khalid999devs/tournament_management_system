import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPageShell,
  publicInformationStyles as styles,
} from "@/components/brand/public-page-shell";
import results from "@/features/matches/components/public-results.module.css";
import { getPublicResults } from "@/features/matches/server/public-results";
import { formatDhakaDateTime } from "@/lib/dates";
import { ordinal } from "@/features/scoring/domain/ranking";

export const metadata: Metadata = {
  title: "Results",
  description: "Official NDCAK Indoor Games Championship results and brackets.",
};

export const revalidate = 60;

function statusText(status: string, scheduledAt: string | null) {
  if (status === "IN_PROGRESS") return "Live";
  if (status === "POSTPONED") return "Postponed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "WALKOVER") return "Walkover";
  if (status === "COMPLETED") return "Final";
  return scheduledAt
    ? formatDhakaDateTime(scheduledAt)
    : "Time to be announced";
}

export default async function ResultsPage() {
  const data = await getPublicResults().catch(() => null);

  if (!data?.enabled || data.games.length === 0) {
    return (
      <PublicPageShell
        eyebrow="Official results"
        title="Follow the championship."
        intro="Confirmed results and brackets appear here once the organisers publish them. Live scores stay with the match officials until a result is confirmed."
      >
        <section className={styles.empty}>
          <div>
            <Trophy size={42} aria-hidden="true" />
            <h2>Results are not published yet</h2>
            <p>
              This page shows confirmed match results, brackets and final
              placements once publication is switched on for the event.
            </p>
            <Link href="/schedule">View schedule</Link>
          </div>
        </section>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell
      eyebrow="Official results"
      title="Results and brackets."
      intro="Every result here has been confirmed by a match official. Scores in progress are not shown until they are final."
    >
      <nav className={results.gameNav} aria-label="Games">
        {data.games.map((game) => (
          <a key={game.id} href={`#game-${game.id}`}>
            {game.name}
          </a>
        ))}
      </nav>
      <div className={results.games}>
        {data.games.map((game) => (
          <section
            key={game.id}
            id={`game-${game.id}`}
            className={results.game}
            aria-labelledby={`title-${game.id}`}
          >
            <h2 id={`title-${game.id}`}>{game.name}</h2>
            {game.podium.length ? (
              <ol
                className={results.podium}
                aria-label={`${game.name} final placings`}
              >
                {game.podium.map((place) => (
                  <li key={place.placement}>
                    <span>
                      {place.placement === 1
                        ? "Champion"
                        : place.placement === 2
                          ? "Runner-up"
                          : ordinal(place.placement)}
                    </span>
                    <strong>{place.name}</strong>
                    <small>{place.department}</small>
                  </li>
                ))}
              </ol>
            ) : null}
            <div
              className={results.rounds}
              role="region"
              aria-label={`${game.name} bracket`}
              tabIndex={0}
            >
              {game.rounds.map((round) => (
                <div key={round.sequence} className={results.round}>
                  <h3>{round.name}</h3>
                  <div className={results.roundMatches}>
                    {round.matches.map((match) => (
                      <article key={match.code} className={results.match}>
                        <header>
                          <span>{match.code}</span>
                          <span
                            className={
                              match.status === "IN_PROGRESS"
                                ? results.live
                                : undefined
                            }
                          >
                            {statusText(match.status, match.scheduledAt)}
                          </span>
                        </header>
                        <ul>
                          {match.entrants.length === 0 ? (
                            <li>To be decided</li>
                          ) : null}
                          {match.entrants.map((entrant) => (
                            <li
                              key={entrant.name}
                              data-winner={entrant.winner || undefined}
                            >
                              <span>
                                {match.entrants.length > 2 && entrant.placement
                                  ? `${ordinal(entrant.placement)} · `
                                  : ""}
                                {entrant.name}
                              </span>
                              <small>{entrant.department}</small>
                            </li>
                          ))}
                          {match.entrants.length === 1 ? (
                            <li>To be decided</li>
                          ) : null}
                        </ul>
                        {match.displayScore ? (
                          <span className={results.score}>
                            {match.displayScore}
                          </span>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PublicPageShell>
  );
}
