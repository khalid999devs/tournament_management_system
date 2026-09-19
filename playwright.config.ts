import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000", browserName: "chromium" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/dev/email-preview",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
