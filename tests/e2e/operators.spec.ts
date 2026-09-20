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
  await adminPage.getByRole("radio", { name: /A whole game/ }).check();
  await adminPage
    .getByLabel("Target")
    .selectOption({ label: "Mobile Football" });
  await adminPage
    .getByRole("radio", { name: /Score and confirm results/ })
    .check();
  await adminPage.getByRole("button", { name: "Give access" }).click();
  await expect(adminPage).toHaveURL(
    new RegExp(`${operatorPath}\\?message=assignment_granted`),
  );

  // Granting the same game again replaces that assignment instead of adding
  // a second one beside it.
  await adminPage.getByRole("radio", { name: /A whole game/ }).check();
  await adminPage
    .getByLabel("Target")
    .selectOption({ label: "Mobile Football" });
  await adminPage.getByRole("radio", { name: /Score only/ }).check();
  await adminPage.getByRole("button", { name: "Give access" }).click();
  await expect(adminPage).toHaveURL(
    new RegExp(`${operatorPath}\\?message=assignment_updated`),
  );
  const assignments = adminPage.locator("section", {
    has: adminPage.getByRole("heading", { name: "Assignments" }),
  });
  await expect(
    assignments.getByText("Mobile Football", { exact: true }),
  ).toHaveCount(1);
  await expect(assignments.getByText("Score only")).toBeVisible();

  // Put the operator back on full scoring for the rest of the run.
  await adminPage.getByRole("radio", { name: /A whole game/ }).check();
  await adminPage
    .getByLabel("Target")
    .selectOption({ label: "Mobile Football" });
  await adminPage
    .getByRole("radio", { name: /Score and confirm results/ })
    .check();
  await adminPage.getByRole("button", { name: "Give access" }).click();
  await expect(adminPage).toHaveURL(
    new RegExp(`${operatorPath}\\?message=assignment_updated`),
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

  // A whole game is handed over, and taken back, from the operator list.
  await adminPage.goto("/admin/operators");
  const card = adminPage.locator("article", {
    has: adminPage.getByText(email),
  });
  await expect(
    card.getByRole("button", { name: "Mobile Football" }),
  ).toHaveAttribute("aria-pressed", "true");

  await card.getByRole("button", { name: "Table Tennis" }).click();
  await expect(adminPage).toHaveURL(/\/admin\/operators\?message=game_added/);
  await operatorPage.reload();
  await expect(
    operatorPage.getByRole("row").filter({ hasText: "Table Tennis" }).first(),
  ).toBeVisible();

  await adminPage.goto("/admin/operators");
  await card.getByRole("button", { name: "Table Tennis" }).click();
  await expect(adminPage).toHaveURL(/\/admin\/operators\?message=game_removed/);
  await operatorPage.reload();
  await expect(
    operatorPage.getByRole("row").filter({ hasText: "Table Tennis" }),
  ).toHaveCount(0);

  // Removing the last assignment empties the list rather than leaving a
  // "removed" row behind.
  await adminPage.goto(operatorPath);
  const panel = adminPage.locator("section", {
    has: adminPage.getByRole("heading", { name: "Assignments" }),
  });
  await expect(panel.getByText("1 active")).toBeVisible();
  await panel.getByRole("button", { name: "Remove" }).click();
  await expect(adminPage).toHaveURL(
    new RegExp(`${operatorPath}\\?message=assignment_revoked`),
  );
  await expect(
    panel.getByRole("heading", { name: "No access yet" }),
  ).toBeVisible();
  await expect(panel.getByText("0 active")).toBeVisible();
  await expect(panel.getByText("Mobile Football")).toHaveCount(0);

  // Players are searched on demand and several can be given at once.
  await adminPage.goto(operatorPath);
  await adminPage.getByRole("radio", { name: /^Players/ }).check();
  const picker = adminPage.locator("form").filter({ hasText: "Which players" });
  await expect(picker.getByRole("checkbox").first()).toBeVisible();
  const first = picker.getByRole("checkbox").first();
  await first.check();
  await adminPage.getByRole("button", { name: /Give access/ }).click();
  await expect(adminPage).toHaveURL(
    new RegExp(`${operatorPath}\\?message=assignments?_granted`),
  );
  await expect(panel.getByText("One player")).toBeVisible();

  await admin.close();
  await operator.close();
});
