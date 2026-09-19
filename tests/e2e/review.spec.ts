import { expect, test } from "@playwright/test";
import {
  authFile,
  db,
  expectAccessible,
  waitForMail,
} from "./support/fixtures";

test.use({ storageState: authFile("admin") });

async function pendingRegistration() {
  const [row] = await db()`
    select r.id, r.code, p.email
    from registrations r join participants p on p.id = r.participant_id
    where r.status = 'PENDING_REVIEW'
    order by r.created_at limit 1`;
  return row as { id: string; code: string; email: string };
}

async function capacity(registrationId: string) {
  return db()`
    select tg.id, tg.reserved_count, tg.confirmed_count
    from registration_game_entries e
    join tournament_games tg on tg.id = e.tournament_game_id
    where e.registration_id = ${registrationId}
    order by tg.id`;
}

test("admin finds a pending registration and approves it; the player gets a confirmation with a calendar invite", async ({
  page,
}) => {
  const registration = await pendingRegistration();
  const before = await capacity(registration.id);

  await page.goto("/admin/registrations?status=PENDING_REVIEW");
  await page.getByLabel("Search").fill(registration.code);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`q=${registration.code}`));
  await page.getByRole("link", { name: `Review ${registration.code}` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    registration.code,
  );

  await page.getByRole("button", { name: "Approve registration" }).click();
  await expect(page.getByText(/approved/i).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review complete" }),
  ).toBeVisible();
  await expectAccessible(page);

  const [row] =
    await db()`select status from registrations where id = ${registration.id}`;
  expect(row.status).toBe("CONFIRMED");
  const after = await capacity(registration.id);
  after.forEach((game, index) => {
    expect(game.reserved_count).toBe(before[index].reserved_count - 1);
    expect(game.confirmed_count).toBe(before[index].confirmed_count + 1);
  });

  const mail = await waitForMail(
    (item) =>
      item.to.includes(registration.email) && /text\/calendar/.test(item.raw),
  );
  expect(mail.text).toContain(registration.code);
});

test("admin rejects a registration with a reason; its places are released and the player is told why", async ({
  page,
}) => {
  const registration = await pendingRegistration();
  const before = await capacity(registration.id);

  await page.goto(`/admin/registrations/${registration.id}`);
  await page
    .getByLabel("Reason shown to the participant")
    .fill(
      "We could not find this transaction ID. Please register again with the correct one.",
    );
  await page.getByRole("button", { name: "Reject and release slots" }).click();
  await expect(
    page.getByRole("heading", { name: "Review complete" }),
  ).toBeVisible();

  const after = await capacity(registration.id);
  after.forEach((game, index) => {
    expect(game.reserved_count).toBe(before[index].reserved_count - 1);
    expect(game.confirmed_count).toBe(before[index].confirmed_count);
  });

  const mail = await waitForMail(
    (item) =>
      item.to.includes(registration.email) &&
      item.text.includes("could not find this transaction ID"),
  );
  expect(mail.text).toContain(registration.code);
});

test("a double-clicked approval is applied once", async ({ page }) => {
  const registration = await pendingRegistration();
  await page.goto(`/admin/registrations/${registration.id}`);
  await page.getByRole("button", { name: "Approve registration" }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Review complete" }),
  ).toBeVisible();

  const [audits] = await db()`
    select count(*)::int as count from audit_logs
    where entity_id = ${registration.id} and action like '%APPROVED%'`;
  expect(audits.count).toBe(1);
  const [emails] = await db()`
    select count(*)::int as count from notifications
    where registration_id = ${registration.id} and type = 'REGISTRATION_APPROVED'`;
  expect(emails.count).toBe(1);
});
