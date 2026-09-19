import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { authFile, horizontalOverflow } from "./support/fixtures";
import { e2eRoot } from "./support/paths";
import { adminRoutes, operatorRoutes, publicRoutes } from "./support/routes";

// SHOTS=1 also saves full-page screenshots for visual review.
const shots = process.env.SHOTS === "1";
const widths = [320, 390, 768, 1024, 1440];

async function check(
  page: Page,
  routes: string[],
  width: number,
  group: string,
) {
  const problems: string[] = [];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState("load");
    await page.waitForTimeout(300);
    const overflow = await horizontalOverflow(page);
    if (overflow) problems.push(`${route}: ${overflow}`);
    if (shots) {
      const name = `${group}${route.replace(/[/?=&]+/g, "_")}`.slice(0, 80);
      const file = path.join(e2eRoot, "shots", String(width), `${name}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, fullPage: true });
    }
  }
  return problems;
}

for (const width of widths) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: width < 800 ? 844 : 900 } });

    test("public pages do not scroll sideways", async ({ page }) => {
      expect(await check(page, publicRoutes, width, "public")).toEqual([]);
    });

    test.describe("admin", () => {
      test.use({ storageState: authFile("admin") });
      test("admin pages do not scroll sideways", async ({ page }) => {
        expect(await check(page, await adminRoutes(), width, "admin")).toEqual(
          [],
        );
      });
    });

    test.describe("operator", () => {
      test.use({ storageState: authFile("operatorA") });
      test("operator pages do not scroll sideways", async ({ page }) => {
        expect(await check(page, operatorRoutes(), width, "operator")).toEqual(
          [],
        );
      });
    });
  });
}
