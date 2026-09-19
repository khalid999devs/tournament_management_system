import { expect, test } from "@playwright/test";
import { run } from "./support/fixtures";

test("responses carry the security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("robots keep staff pages out of search, and the sitemap lists public pages", async ({
  request,
  page,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/operator", "/staff", "/api"]) {
    expect(robots).toContain(`Disallow: ${path}`);
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/register</loc>");

  await page.goto("/staff/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("protected endpoints refuse anonymous requests", async ({
  request,
  page,
}) => {
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  expect(
    (
      await request.get("/api/cron/daily", {
        headers: { authorization: "Bearer wrong-secret-wrong-secret" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get(`/staff/api/matches/${run.footballMatches[0]}`)
    ).status(),
  ).toBe(401);
  expect(
    (await request.get("/admin/reports/export/registrations")).status(),
  ).toBe(403);
  expect((await request.get("/dev/email-preview")).status()).toBe(404);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staff\/login/);
});

test("the health check reports the database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    database: "reachable",
  });
});

test("repeated failed sign-ins are slowed down", async ({ page }) => {
  const email = `e2e-nobody-${run.tag}@example.com`;
  let message = "";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.goto("/staff/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.waitForURL(/error=/);
    message = await page.locator("form").locator("xpath=..").innerText();
    if (/Too many sign-in attempts/.test(message)) break;
  }
  expect(message).toMatch(/Too many sign-in attempts/);
});
