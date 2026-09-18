import Link from "next/link";
import Image from "next/image";
import { PublicHeader } from "@/components/brand/public-header";

const games = [
  { name: "Chess", detail: "Strategy under pressure", mark: "CH" },
  {
    name: "Table Tennis",
    detail: "Fast rallies. Precise finishes.",
    mark: "TT",
  },
  { name: "Carrom", detail: "Control, patience, accuracy", mark: "CA" },
  { name: "Mobile Football", detail: "Head-to-head digital play", mark: "MF" },
];

const milestones = [
  { label: "Register once", detail: "Choose every game in one form." },
  {
    label: "Payment review",
    detail: "Your payment is verified by the event team.",
  },
  { label: "Compete", detail: "Receive confirmation and event instructions." },
];

export default function Home() {
  return (
    <main>
      <section className="hero-shell">
        <PublicHeader />

        <div className="hero-grid page-width">
          <div className="hero-copy">
            <p className="eyebrow">Play · Connect · Compete · Belong</p>
            <h1>
              Every move counts.
              <span>Every player belongs.</span>
            </h1>
            <p className="hero-intro">
              One championship. Multiple games. A simpler way for KUET students
              to register, compete, and follow the action.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/register">
                Start registration <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-quiet" href="/schedule">
                View schedule
              </Link>
            </div>
            <p className="availability">
              <span aria-hidden="true" /> Registration dates will be announced
              soon
            </p>
          </div>

          <div className="event-board" aria-label="Championship highlights">
            <div className="event-board-topline">
              <span>NDCAK 2026</span>
              <span className="status-pill">Coming soon</span>
            </div>
            <div className="event-emblem" aria-hidden="true">
              <span>N</span>
            </div>
            <div className="event-board-message">
              <p>More than a game</p>
              <strong>A stronger community</strong>
            </div>
            <dl className="event-meta">
              <div>
                <dt>Venue</dt>
                <dd>KUET Campus</dd>
              </div>
              <div>
                <dt>For</dt>
                <dd>KUET Students</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>Multiple Games</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="hero-ribbon">
          <div className="page-width ribbon-inner">
            <p>Registration</p>
            <strong>Choose your games in one clear application.</strong>
            <Link href="/register">
              How it works <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section
        className="games-section page-width"
        aria-labelledby="games-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow dark">Championship lineup</p>
            <h2 id="games-heading">Find your arena.</h2>
          </div>
          <p>
            Register for one or more eligible games, review the combined fee,
            and submit payment information once.
          </p>
        </div>

        <div className="games-grid">
          {games.map((game, index) => (
            <article className="game-card" key={game.name}>
              <div className="game-mark" aria-hidden="true">
                {game.mark}
              </div>
              <div>
                <p>0{index + 1}</p>
                <h3>{game.name}</h3>
                <span>{game.detail}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="journey-section">
        <div className="page-width journey-grid">
          <div>
            <p className="eyebrow">A straightforward entry</p>
            <h2>Three steps. No participant account.</h2>
          </div>
          <ol>
            {milestones.map((milestone, index) => (
              <li key={milestone.label}>
                <span>{index + 1}</span>
                <div>
                  <strong>{milestone.label}</strong>
                  <p>{milestone.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="site-footer">
        <div className="page-width footer-inner">
          <Image
            className="footer-brand"
            src="/brand/ndcak-lockup.png"
            alt="Notre Dame College Association of KUET"
            width={1536}
            height={700}
          />
          <Link href="/staff/login">Staff login</Link>
        </div>
      </footer>
    </main>
  );
}
