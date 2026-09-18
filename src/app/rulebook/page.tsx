import type { Metadata } from "next";
import {
  PublicPageShell,
  publicInformationStyles as styles,
} from "@/components/brand/public-page-shell";

export const metadata: Metadata = {
  title: "Rulebook",
  description: "General and game-specific NDCAK Indoor Games rules.",
};

const sections = [
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

export default function RulebookPage() {
  return (
    <PublicPageShell
      eyebrow="Official document"
      title="Tournament rulebook."
      intro="General event rules apply to every participant. Final game-specific formats, tie-breaks, walkovers, and scoring rules will be published after committee approval."
    >
      <div className={styles.rulebookLayout}>
        <nav className={styles.rulebookNav} aria-label="Rulebook sections">
          <p>General rules</p>
          {sections.map((section, index) => (
            <a href={`#rule-${index + 1}`} key={section.title}>
              <span>0{index + 1}</span> {section.title}
            </a>
          ))}
        </nav>
        <div className={styles.ruleGrid}>
          {sections.map((section, index) => (
            <article id={`rule-${index + 1}`} key={section.title}>
              <span>0{index + 1}</span>
              <h2>{section.title}</h2>
              <p>{section.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
