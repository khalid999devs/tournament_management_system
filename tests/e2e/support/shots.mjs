// Takes screenshots of the admin screens that are hard to get right, so they
// can be reviewed by eye. Run against a kept end-to-end environment:
//
//   pnpm test:e2e --keep -g "the skip link"
//   node tests/e2e/support/shots.mjs
//
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const base = "http://localhost:3100";
const out = process.argv[2] ?? "test-results/shots";
const storage = "test-results/e2e/auth/admin.json";

const sql = postgres(
  process.env.E2E_DATABASE_URL ??
    "postgresql://postgres@127.0.0.1:55432/ndcak_e2e",
  { max: 1, prepare: false, max_pipeline: 0 },
);

const [undrawn] = await sql`
  select tg.id, g.name from tournament_games tg
  join games g on g.id = tg.game_id
  where not exists (select 1 from rounds r where r.tournament_game_id = tg.id)
  order by tg.sort_order limit 1`;
const [drawn] = await sql`
  select tg.id from tournament_games tg
  where exists (select 1 from rounds r where r.tournament_game_id = tg.id)
  order by tg.sort_order limit 1`;
const [operator] = await sql`
  select id from staff_profiles where role = 'SCORE_OPERATOR'
  order by created_at limit 1`;
await sql.end();

const screens = [
  { name: "games-draw", url: `/admin/games/${undrawn.id}` },
  { name: "games-drawn", url: `/admin/games/${drawn.id}` },
  { name: "operator-access", url: `/admin/operators/${operator.id}` },
  { name: "operators", url: "/admin/operators" },
  { name: "registrations", url: "/admin/registrations" },
  { name: "dashboard", url: "/admin" },
  { name: "reports", url: "/admin/reports" },
];

const widths = [
  { tag: "1440", size: { width: 1440, height: 1200 } },
  { tag: "390", size: { width: 390, height: 900 } },
];

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

for (const width of widths) {
  const context = await browser.newContext({
    storageState: storage,
    viewport: width.size,
  });
  const page = await context.newPage();

  for (const screen of screens) {
    await page.goto(base + screen.url, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(out, `${screen.name}-${width.tag}.png`),
      fullPage: true,
    });
  }

  // Each guide, open.
  for (const [name, url] of [
    ["guide-scoring", `/admin/games/${undrawn.id}`],
    ["guide-draw", `/admin/games/${undrawn.id}`],
  ]) {
    await page.goto(base + url, { waitUntil: "networkidle" });
    const label = name.endsWith("scoring")
      ? "How scoring works"
      : "How the draw works";
    await page.getByRole("button", { name: label }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `${name}-${width.tag}.png`) });
    await page.keyboard.press("Escape");
  }

  // The player picker, open, with results loaded.
  await page.goto(base + `/admin/operators/${operator.id}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("radio", { name: /Players/ }).check();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(out, `player-picker-${width.tag}.png`),
    fullPage: true,
  });

  await context.close();
}

await browser.close();
console.log(`Screenshots in ${out}`);
