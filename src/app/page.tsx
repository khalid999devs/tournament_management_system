import { Brain, CircleDot, Gamepad2, Medal } from "lucide-react";
import Link from "next/link";
import { PublicFooter } from "@/components/brand/public-footer";
import { PublicHeader } from "@/components/brand/public-header";

const games = [
  { name: "Chess", detail: "Strategy under pressure", icon: Brain },
  {
    name: "Table Tennis",
    detail: "Fast rallies. Precise finishes.",
    icon: CircleDot,
  },
  {
    name: "Carrom",
    detail: "Control, patience, accuracy",
    icon: Medal,
  },
  {
    name: "Mobile Football",
    detail: "Head-to-head digital play",
    icon: Gamepad2,
  },
];

const platformFacts = [
  { value: "One", label: "clear application" },
  { value: "No", label: "participant account" },
  { value: "Live", label: "official schedule" },
  { value: "Verified", label: "published results" },
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
        <div className="announcement-rail">
          <div className="page-width announcement-inner">
            <span>Official NDCAK tournament platform</span>
            <span>Registration dates will be announced</span>
            <span>Built for KUET students</span>
          </div>
        </div>

        <div className="hero-grid page-width">
          <div className="hero-copy">
            <p className="eyebrow">Play · Connect · Compete · Belong</p>
            <h1>
              NDCAK indoor games.
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

          <div className="arena-panel" aria-label="Championship game lineup">
            <div className="arena-panel-heading">
              <div>
                <p>Championship lineup</p>
                <strong>Choose your arena</strong>
              </div>
              <span>Configuration pending</span>
            </div>
            <div className="arena-grid">
              {games.map((game) => {
                const Icon = game.icon;

                return (
                  <article className="arena-card" key={game.name}>
                    <Icon size={24} aria-hidden="true" />
                    <div>
                      <h2>{game.name}</h2>
                      <p>{game.detail}</p>
                    </div>
                    <span>Details coming soon</span>
                  </article>
                );
              })}
            </div>
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
        aria-labelledby="platform-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow dark">Designed for clarity</p>
            <h2 id="platform-heading">Everything participants need.</h2>
          </div>
          <p>
            One official source for registration, event instructions, schedules,
            rulebooks, and approved results—without forcing participants to
            create an account.
          </p>
        </div>

        <div className="platform-facts">
          {platformFacts.map((fact) => (
            <article key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
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

      <PublicFooter />
    </main>
  );
}
