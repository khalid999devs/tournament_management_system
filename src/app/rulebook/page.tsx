import type { Metadata } from "next";
import {
  PublicPageShell,
  publicInformationStyles as styles,
} from "@/components/brand/public-page-shell";
import { getPublicEvent } from "@/features/tournaments/server/get-registration-tournament";

export const metadata: Metadata = {
  title: "Rulebook",
  description: "General and game-specific NDCAK Indoor Games rules.",
};

export const revalidate = 60;

const generalRules = [
  {
    title: "Eligibility",
    copy: "Participation is limited to eligible KUET students. The committee may request a valid student identity check before competition.",
  },
  {
    title: "Fair play",
    copy: "Participants must follow organizer and operator instructions, respect opponents, and avoid conduct that undermines a fair result.",
  },
  {
    title: "Reporting",
    copy: "Confirmed participants should arrive within the published reporting window. Late arrival and no-show handling will follow each game's final rules.",
  },
  {
    title: "Results and disputes",
    copy: "Only authorized staff enter official results. Any correction or dispute is reviewed by the organizing committee and recorded in the system.",
  },
];

export default async function RulebookPage() {
  const event = await getPublicEvent().catch(() => null);
  const gameRules = (event?.games ?? [])
    .filter((game) => game.rules)
    .map((game) => ({ title: game.name, copy: game.rules ?? "" }));
  const sections = [...generalRules, ...gameRules];

  return (
    <PublicPageShell
      eyebrow="Official document"
      title="Tournament rulebook."
      intro={
        gameRules.length
          ? "General event rules apply to every participant, followed by the rules for each game."
          : "General event rules apply to every participant. Game-specific formats, tie-breaks, walkovers and scoring rules are published here once confirmed."
      }
    >
      <div className={styles.rulebookLayout}>
        <nav className={styles.rulebookNav} aria-label="Rulebook sections">
          <p>Sections</p>
          {sections.map((section, index) => (
            <a href={`#rule-${index + 1}`} key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span> {section.title}
            </a>
          ))}
        </nav>
        <div className={styles.ruleGrid}>
          {sections.map((section, index) => (
            <article id={`rule-${index + 1}`} key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
              {section.copy.split(/\n{2,}/).map((paragraph, part) => (
                <p key={part}>{paragraph}</p>
              ))}
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
