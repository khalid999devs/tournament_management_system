import { defineConfig } from "@playwright/test";

// Run through `pnpm test:e2e`, which prepares the database, builds and starts
// the app, then calls Playwright with E2E_BASE_URL set.
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/email-preview.spec.ts", "**/support/**"],
  outputDir: "test-results/e2e/artifacts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "test-results/e2e/report" }],
  ],
  globalSetup: "./tests/e2e/support/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
