import { Globe, Mail } from "lucide-react";
import type { Metadata } from "next";
import { PublicPageShell } from "@/components/brand/public-page-shell";
import { GithubMark, LinkedinMark } from "./brand-icons";
import data from "./developers.json";
import styles from "./developers.module.css";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "The students who built the NDCAK Indoor Games Championship platform.",
};

type Person = (typeof data.people)[number];

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function profileLinks(person: Person) {
  const { website, github, linkedin, email } = person.links;
  return [
    website && { href: website, label: "Personal site", icon: Globe },
    github && { href: github, label: "GitHub", icon: GithubMark },
    linkedin && { href: linkedin, label: "LinkedIn", icon: LinkedinMark },
    email && { href: `mailto:${email}`, label: "Email", icon: Mail },
  ].filter(Boolean) as {
    href: string;
    label: string;
    icon: (props: { size?: number }) => React.ReactElement;
  }[];
}

export default function DevelopersPage() {
  return (
    <PublicPageShell
      eyebrow="Behind the platform"
      title="Developers."
      intro={data.intro}
    >
      <ul className={styles.people}>
        {data.people.map((person) => (
          <li
            key={person.name}
            className={
              person.lead ? `${styles.person} ${styles.lead}` : styles.person
            }
          >
            <span className={styles.avatar} aria-hidden="true">
              {initials(person.name)}
            </span>

            <div className={styles.body}>
              <p className={styles.role}>{person.role}</p>
              <h2>{person.name}</h2>
              <p className={styles.designation}>{person.designation}</p>

              <ul className={styles.meta}>
                <li>{person.department}</li>
                <li>{person.session}</li>
                <li>Roll {person.roll}</li>
              </ul>

              <p className={styles.summary}>{person.summary}</p>

              <ul className={styles.links}>
                {profileLinks(person).map(({ href, label, icon: Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      aria-label={`${person.name} on ${label}`}
                      rel={
                        href.startsWith("mailto:") ? undefined : "noreferrer"
                      }
                      target={href.startsWith("mailto:") ? undefined : "_blank"}
                    >
                      <Icon size={19} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.note}>
        Questions about the site go to the committee at the address in the
        footer.
      </p>
    </PublicPageShell>
  );
}
