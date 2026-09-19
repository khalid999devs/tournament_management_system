import { defineConfig } from "@playwright/test";

// The email preview page exists only in development, so it has its own run.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "email-preview.spec.ts",
  use: { baseURL: "http://localhost:3000", browserName: "chromium" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/dev/email-preview",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
