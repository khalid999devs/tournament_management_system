import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { authDir, manifestPath, type Role, type RunManifest } from "./paths";

// Signs each seeded staff member in once and saves the session for the specs.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const passwords = JSON.parse(process.env.E2E_PASSWORDS ?? "{}") as Record<
    Role,
    string
  >;
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as RunManifest;
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const role of Object.keys(manifest.users) as Role[]) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto("/staff/login");
      await page.getByLabel("Email address").fill(manifest.users[role].email);
      await page.getByLabel("Password").fill(passwords[role]);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(role === "admin" ? /\/admin/ : /\/operator/);
      await context.storageState({ path: path.join(authDir, `${role}.json`) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
