import path from "node:path";

// Everything a run writes lives under test-results/e2e, which git ignores.
export const e2eRoot = path.resolve("test-results/e2e");
export const mailDir = path.join(e2eRoot, "mail");
export const authDir = path.join(e2eRoot, "auth");
export const manifestPath = path.join(e2eRoot, "run.json");

export const appPort = 3100;
export const smtpPort = 2526;

export function isLocalDatabase(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export type Role = "admin" | "operatorA" | "operatorB";

export type RunManifest = {
  tag: string;
  users: Record<Role, { id: string; email: string; name: string }>;
  tournamentId: string;
  games: Record<string, string>;
  tableTennisMatches: { semiFinals: string[]; final: string };
  footballMatches: string[];
  cardsMatches: string[];
};
