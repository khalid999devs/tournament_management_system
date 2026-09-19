const url = process.env.TEST_DATABASE_URL;

if (!url) {
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable PostgreSQL database. See docs/qa/INTEGRATION_TESTS.md.",
  );
}

// Every test truncates tables, so refuse anything that looks like a hosted
// project rather than a throwaway local database.
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error(
    `Integration tests only run against a local database, not ${host}.`,
  );
}

process.env.DATABASE_URL = url;
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
