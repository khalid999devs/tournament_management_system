import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import {
  authDir,
  mailDir,
  manifestPath,
  type Role,
  type RunManifest,
} from "./paths";

export const run = JSON.parse(
  fs.readFileSync(manifestPath, "utf8"),
) as RunManifest;

export const authFile = (role: Role) => path.join(authDir, `${role}.json`);

let client: postgres.Sql | undefined;
export function db() {
  client ??= postgres(process.env.E2E_DATABASE_URL!, { max: 2 });
  return client;
}

export type Mail = {
  to: string;
  subject: string;
  raw: string;
  text: string;
};

function decodeQuotedPrintable(value: string) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function decodeSubject(value: string) {
  return value.replace(
    /=\?utf-8\?([BQ])\?([^?]*)\?=/gi,
    (_, kind: string, text: string) =>
      kind.toUpperCase() === "B"
        ? Buffer.from(text, "base64").toString("utf8")
        : decodeQuotedPrintable(text.replace(/_/g, " ")),
  );
}

export function readMail(): Mail[] {
  if (!fs.existsSync(mailDir)) return [];
  return fs
    .readdirSync(mailDir)
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(mailDir, file), "utf8");
      const to = raw.match(/^X-Sink-Recipients: (.*)$/m)?.[1] ?? "";
      const subjectLines = raw.match(/^Subject: (.*(?:\r?\n[ \t].*)*)/m)?.[1];
      const subject = decodeSubject(
        (subjectLines ?? "").replace(/\r?\n[ \t]/g, " "),
      );
      // Base64 parts are decoded so tests can search the readable text.
      const decodedParts = [
        ...raw.matchAll(
          /Content-Transfer-Encoding: base64\r?\n(?:[^\r\n]+\r?\n)*\r?\n([A-Za-z0-9+/=\r\n]+)/g,
        ),
      ].map((match) =>
        Buffer.from(match[1].replace(/\s+/g, ""), "base64").toString("utf8"),
      );
      const text = [decodeQuotedPrintable(raw), ...decodedParts].join("\n");
      return { to, subject, raw, text };
    });
}

export async function waitForMail(
  predicate: (mail: Mail) => boolean,
  timeoutMs = 20_000,
) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const found = readMail().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Expected email did not arrive.");
}

// WCAG 2.1 A and AA rules, the level the PRD targets.
export async function accessibilityProblems(page: Page, label = page.url()) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map(
    (violation) =>
      `${label} :: ${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 4)
        .map(
          (node) =>
            `    ${node.target.join(" ")} :: ${node.failureSummary?.split("\n")[1]?.trim() ?? ""}`,
        )
        .join("\n"),
  );
}

export async function expectAccessible(page: Page, label = page.url()) {
  expect(await accessibilityProblems(page, label)).toEqual([]);
}

export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width + 1) return null;
    const offenders: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        rect.right > width + 1 &&
        rect.width > 0 &&
        style.position !== "fixed"
      ) {
        offenders.push(
          `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(" ").join(".")}` : ""} right=${Math.round(rect.right)}`,
        );
        if (offenders.length > 4) break;
      }
    }
    return `scrollWidth ${document.documentElement.scrollWidth} > ${width}: ${offenders.join(", ")}`;
  });
}

export async function expectNoHorizontalScroll(page: Page) {
  expect(await horizontalOverflow(page)).toBeNull();
}
