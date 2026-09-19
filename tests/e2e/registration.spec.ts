import { expect, test, type Page } from "@playwright/test";
import {
  db,
  expectAccessible,
  expectNoHorizontalScroll,
  run,
  waitForMail,
} from "./support/fixtures";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

// Players tap the whole game card; the checkbox inside is visually hidden.
async function pickGame(page: Page, name: RegExp) {
  const box = page.getByRole("checkbox", { name });
  await page.locator("label", { has: box }).click();
  await expect(box).toBeChecked();
}

test("a student registers from a phone and gets a pending receipt by email", async ({
  page,
}) => {
  const email = `tahmid.${run.tag}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Tahmid Hasan");
  await page.getByLabel("Student ID").fill("2107999");
  await page.getByLabel("Academic year").selectOption("2nd year");
  await page.getByLabel("Department").selectOption("Civil Engineering");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill("01712345699");
  await pickGame(page, /^Chess/);
  await pickGame(page, /^Carrom/);
  await expect(page.getByText("2 of 3 selected")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();

  await expect(page).toHaveURL(/\/register\/review$/);
  await expect(page.getByText("Tahmid Hasan")).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("link", { name: /Continue to payment/ }).click();

  await expect(page).toHaveURL(/\/register\/payment$/);
  await page.getByText("Nagad", { exact: true }).click();
  await expect(page.getByText("01811-000222 (Personal)")).toBeVisible();
  await expect(page.getByText(/(৳|BDT)\s?110$/).first()).toBeVisible();
  await page
    .getByRole("textbox", { name: "Transaction ID" })
    .fill(`NG${run.tag.toUpperCase()}77`);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: /Submit registration/ }).click();

  await expect(page).toHaveURL(/\/register\/submitted\?code=/);
  const code = new URL(page.url()).searchParams.get("code")!;
  await expect(page.getByText(code)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "You are almost in." }),
  ).toBeVisible();
  await expectAccessible(page);

  const [registration] = await db()`
    select r.status, count(e.id)::int as games
    from registrations r join registration_game_entries e on e.registration_id = r.id
    where r.code = ${code} group by r.status`;
  expect(registration).toEqual({ status: "PENDING_REVIEW", games: 2 });

  const receipt = await waitForMail((mail) => mail.to.includes(email));
  expect(receipt.text).toContain(code);
  expect(receipt.text).not.toMatch(/you are confirmed/i);
});

test("a second registration with the same transaction ID is refused with a clear message", async ({
  page,
}) => {
  const [existing] = await db()`
    select p.transaction_id_raw as transaction_id, p.provider from payments p order by p.created_at desc limit 1`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Copy Cat");
  await page.getByLabel("Student ID").fill("2107998");
  await page.getByLabel("Academic year").selectOption("1st year");
  await page.getByLabel("Department").selectOption("Mechanical Engineering");
  await page.getByLabel("Email").fill(`copy.${run.tag}@example.com`);
  await page.getByLabel("Phone").fill("01812345698");
  await pickGame(page, /^Chess/);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("link", { name: /Continue to payment/ }).click();
  const methodName = { BKASH: "bKash", NAGAD: "Nagad", ROCKET: "Rocket" }[
    existing.provider as string
  ]!;
  await page.getByText(methodName, { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Transaction ID" })
    .fill(existing.transaction_id);
  await page.getByRole("button", { name: /Submit registration/ }).click();

  await expect(
    page.getByText(/This transaction ID has already been used/),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register\/payment$/);
});

test("two students race for the last place: one is in, the other is asked to change games", async ({
  browser,
}) => {
  await db()`
    update tournament_games set capacity = reserved_count + confirmed_count + 1
    where id = ${run.games.Carrom}`;
  try {
    const pages = await Promise.all(
      [0, 1].map(async (index) => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
        const page = await context.newPage();
        await page.goto("/register");
        await page.getByLabel("Full name").fill(`Last Place ${index}`);
        await page.getByLabel("Student ID").fill(`210790${index}`);
        await page.getByLabel("Academic year").selectOption("3rd year");
        await page.getByLabel("Department").selectOption("Civil Engineering");
        await page
          .getByLabel("Email")
          .fill(`last.${index}.${run.tag}@example.com`);
        await page.getByLabel("Phone").fill(`0171234580${index}`);
        await pickGame(page, /^Carrom/);
        await page.getByRole("button", { name: "Review", exact: true }).click();
        await page.getByRole("link", { name: /Continue to payment/ }).click();
        await page
          .getByRole("textbox", { name: "Transaction ID" })
          .fill(`LAST${index}${run.tag.toUpperCase()}`);
        return page;
      }),
    );
    await Promise.all(
      pages.map((page) =>
        page.getByRole("button", { name: /Submit registration/ }).click(),
      ),
    );
    const outcomes = await Promise.all(
      pages.map((page) =>
        Promise.race([
          page.waitForURL(/\/register\/submitted/).then(() => "in"),
          page
            .getByRole("heading", { name: "Your games need a change" })
            .waitFor()
            .then(() => "asked to change"),
        ]),
      ),
    );
    expect(outcomes.sort()).toEqual(["asked to change", "in"]);
  } finally {
    await db()`update tournament_games set capacity = 32 where id = ${run.games.Carrom}`;
  }
});
