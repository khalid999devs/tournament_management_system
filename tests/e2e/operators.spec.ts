import { expect, test } from "@playwright/test";
import {
  authFile,
  db,
  expectAccessible,
  run,
  waitForMail,
} from "./support/fixtures";

test("admin invites an operator, the operator sets a password, and sees only the assigned game", async ({
  browser,
}) => {
  const email = `e2e-invited-${run.tag}@example.com`;
  const admin = await browser.newContext({ storageState: authFile("admin") });
  const adminPage = await admin.newPage();

  await adminPage.goto("/admin/operators");
  await adminPage.getByLabel("Full name").fill("Mitu Akter");
  await adminPage.getByLabel("Email address").fill(email);
  await adminPage.getByRole("button", { name: /Send invitation/ }).click();
  await expect(adminPage).toHaveURL(
    /\/admin\/operators\/[0-9a-f-]+\?message=created/,
  );
  const operatorPath = new URL(adminPage.url()).pathname;

  const invite = await waitForMail((mail) => mail.to.includes(email));
  const link = invite.text.match(
    /http:\/\/localhost:3100\/auth\/confirm\?token_hash=[^\s"'<>&]+(?:&amp;|&)type=(?:invite|recovery)/,
  )?.[0];
  expect(link, "invitation link").toBeTruthy();

  const operator = await browser.newContext();
  const operatorPage = await operator.newPage();
  await operatorPage.goto(link!.replace("&amp;", "&"));
  await expect(operatorPage).toHaveURL(/\/staff\/set-password/);
  await expectAccessible(operatorPage);
  const password = `Pw-${run.tag}-${Date.now()}`;
  await operatorPage.getByLabel("New password").fill(password);
  await operatorPage.getByLabel("Confirm password").fill(password);
  await operatorPage.getByRole("button", { name: /Set password/ }).click();
  await expect(operatorPage).toHaveURL(/\/operator/);
  await expect(
    operatorPage.getByRole("heading", { name: "No matches to play" }),
  ).toBeVisible();

  // Grant one game; the operator then sees that game's matches and nothing else.
  const game = adminPage.locator("form", {
    has: adminPage.getByRole("heading", { name: "Game", exact: true }),
  });
  await game.getByLabel("Target").selectOption({
    label: "NDCAK Indoor Games Championship · Mobile Football",
  });
  await game.getByLabel("Update scores").check();
  await game.getByLabel("Finalize matches").check();
  await game.getByRole("button", { name: "Grant access" }).click();
  await expect(adminPage).toHaveURL(
    new RegExp(`${operatorPath}\\?message=assignment_granted`),
  );

  await operatorPage.reload();
  const rows = operatorPage.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const text = await rows.allInnerTexts();
  expect(text.length).toBeGreaterThan(0);
  for (const row of text) {
    expect(row).toContain("Mobile Football");
    expect(row).not.toContain("Table Tennis");
  }

  // The operator cannot open admin pages or payment data.
  await operatorPage.goto("/admin/registrations");
  await expect(operatorPage).toHaveURL(/\/operator/);
  const response = await operatorPage.request.get(
    `/staff/api/matches/${run.tableTennisMatches.semiFinals[0]}`,
  );
  expect([403, 404]).toContain(response.status());

  const [profile] =
    await db()`select active from staff_profiles where lower(email) = ${email}`;
  expect(profile.active).toBe(true);
  await admin.close();
  await operator.close();
});
