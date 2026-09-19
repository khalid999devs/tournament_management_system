import { expect, test, type Page } from "@playwright/test";
import { authFile, db, expectAccessible, run } from "./support/fixtures";

const semiFinal = () => run.tableTennisMatches.semiFinals[0];

async function saveSet(page: Page, score: string) {
  const disclosure = page.locator("details", {
    hasText: /Enter set \d+ as a finished score/,
  });
  if ((await disclosure.getAttribute("open")) === null) {
    await disclosure.locator("summary").click();
  }
  await disclosure.getByRole("textbox").fill(score);
  await disclosure.getByRole("button", { name: "Save set" }).click();
  await expect(page.getByText(/All saved/)).toBeVisible();
}

test("two operators on one match: the finalized result stands and the stale typed score is refused", async ({
  browser,
}) => {
  // Operator A on a tablet, operator B on a phone.
  const a = await browser.newContext({
    storageState: authFile("operatorA"),
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
  });
  const b = await browser.newContext({
    storageState: authFile("operatorB"),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  await pageA.goto(`/operator/matches/${semiFinal()}`);
  await pageB.goto(`/operator/matches/${semiFinal()}`);
  await expectAccessible(pageA);

  await pageA.getByRole("button", { name: "Start match" }).click();
  await expect(pageA.getByText(/All saved/)).toBeVisible();
  await saveSet(pageA, "11-7");

  // B sees A's change without reloading (polling covers it even when the
  // live connection is unavailable).
  await expect(pageB.getByRole("list", { name: "Set scores" })).toContainText(
    "11–7",
    {
      timeout: 20_000,
    },
  );

  // B loses signal and types a full correction based on what it last saw.
  await b.setOffline(true);
  const correction = pageB.locator("details", {
    hasText: "Correct all set scores",
  });
  await correction.locator("summary").click();
  await correction.getByRole("textbox").fill("11-9, 11-9, 11-9");
  await correction.getByRole("button", { name: "Replace set scores" }).click();
  await expect(pageB.getByText(/Offline/)).toBeVisible();

  // Meanwhile A finishes the match and confirms the result.
  await saveSet(pageA, "11-5");
  await saveSet(pageA, "11-3");
  await pageA.getByRole("button", { name: "Finalize result" }).click();
  await pageA
    .getByRole("button", { name: "Yes, confirm final result" })
    .click();
  await expect(
    pageA.getByRole("heading", { name: "Final result" }),
  ).toBeVisible();

  // B reconnects: the stale correction is refused, not applied.
  await b.setOffline(false);
  await expect(pageB.getByText("An action needs your attention.")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    pageB.getByRole("heading", { name: "Final result" }),
  ).toBeVisible({
    timeout: 30_000,
  });

  const [match] = await db()`
    select status, score_json from matches where id = ${semiFinal()}`;
  expect(match.status).toBe("COMPLETED");
  expect(match.score_json.sets).toEqual([
    [11, 7],
    [11, 5],
    [11, 3],
  ]);
  const [log] = await db()`
    select count(*)::int as typed from match_updates
    where match_id = ${semiFinal()} and update_type = 'SCORE_SET'`;
  expect(log.typed).toBe(0);

  // The winner moves into the final.
  const [final] = await db()`
    select count(*)::int as entrants from match_entries where match_id = ${run.tableTennisMatches.final}`;
  expect(final.entrants).toBe(1);

  await a.close();
  await b.close();
});

test("the confirmed result is on the public results page", async ({ page }) => {
  await page.goto("/results");
  await expect(page.getByText("Table Tennis").first()).toBeVisible();
  await expect(page.getByText(/3–0|3-0/).first()).toBeVisible();
  await expectAccessible(page);
});
