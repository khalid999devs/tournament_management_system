import { expect, test, type Page } from "@playwright/test";
import { accessibilityProblems, authFile } from "./support/fixtures";
import { adminRoutes, operatorRoutes, publicRoutes } from "./support/routes";

async function scan(page: Page, routes: string[]) {
  const problems: string[] = [];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState("load");
    problems.push(...(await accessibilityProblems(page, route)));
  }
  return problems;
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`WCAG 2.1 AA at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("public pages", async ({ page }) => {
      expect(await scan(page, publicRoutes)).toEqual([]);
    });

    test.describe("admin", () => {
      test.use({ storageState: authFile("admin") });
      test("admin pages", async ({ page }) => {
        expect(await scan(page, await adminRoutes())).toEqual([]);
      });
    });

    test.describe("operator", () => {
      test.use({ storageState: authFile("operatorA") });
      test("operator pages", async ({ page }) => {
        expect(await scan(page, operatorRoutes())).toEqual([]);
      });
    });
  });
}
