import { defineConfig } from "vitest/config";

// Runs only the seed, with the same module aliases as the integration tests.
export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("../../../src", import.meta.url).pathname,
      "server-only": new URL("../../mocks/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/e2e/support/seed.vitest.ts"],
    testTimeout: 240_000,
  },
});
