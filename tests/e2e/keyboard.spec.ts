import { expect, test, type Locator, type Page } from "@playwright/test";
import { run } from "./support/fixtures";

test("the skip link is the first stop and jumps past the navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await page.keyboard.press("Tab");
  const focusedInMain = await page.evaluate(
    () => document.activeElement?.closest("main") !== null,
  );
  expect(focusedInMain).toBe(true);
});

test("the ticker can be paused from the keyboard", async ({ page }) => {
  await page.goto("/");
  const pause = page.getByRole("button", { name: "Pause highlights" });
  await pause.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Play highlights" }),
  ).toBeVisible();
  const state = await page
    .locator(".ticker-track")
    .evaluate((element) => getComputedStyle(element).animationPlayState);
  expect(state).toBe("paused");
});

test.describe("phone menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens and closes from the keyboard", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("link", { name: "Schedule" }).first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

test("registration details can be completed with the keyboard alone", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name").focus();
  await page.keyboard.type("Keyboard Student");
  await page.keyboard.press("Tab");
  await page.keyboard.type("2107555");
  // Type-ahead picks an option in a focused select, as it does for
  // keyboard users.
  await page.keyboard.press("Tab");
  await page.keyboard.type("2");
  await expect(page.getByLabel("Academic year")).toHaveValue("2nd year");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Civ");
  await expect(page.getByLabel("Department")).toHaveValue("Civil Engineering");
  await page.keyboard.press("Tab");
  await page.keyboard.type(`keyboard.${run.tag}@example.com`);
  await page.keyboard.press("Tab");
  await page.keyboard.type("01912345677");

  // Tab to the first game, check the focus ring shows, tick it with Space.
  const chess = page.getByRole("checkbox", { name: /^Chess/ });
  await tabUntil(page, chess);
  const ring = await chess.evaluate(
    (element) => getComputedStyle(element.closest("label")!).outlineStyle,
  );
  expect(ring).toBe("solid");
  await page.keyboard.press("Space");
  await expect(chess).toBeChecked();

  await tabUntil(
    page,
    page.getByRole("button", { name: "Review registration" }),
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/register\/review$/);
});

async function tabUntil(page: Page, target: Locator, limit = 20) {
  for (let step = 0; step < limit; step += 1) {
    if (await target.evaluate((element) => element === document.activeElement))
      return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}
