// Measures every SVG text node against its box, inside the running app.
import { chromium } from "@playwright/test";
import postgres from "postgres";

const sql = postgres("postgresql://postgres@127.0.0.1:55432/ndcak_e2e", {
  max: 1,
  prepare: false,
  max_pipeline: 0,
});
const [undrawn] = await sql`
  select tg.id from tournament_games tg
  where not exists (select 1 from rounds r where r.tournament_game_id = tg.id)
  order by tg.sort_order limit 1`;
const [operator] = await sql`
  select id from staff_profiles where role = 'SCORE_OPERATOR' order by created_at limit 1`;
await sql.end();

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: "test-results/e2e/auth/admin.json",
  viewport: { width: 1440, height: 1000 },
});
const page = await ctx.newPage();

for (const [url, labels] of [
  [`/admin/games/${undrawn.id}`, ["How scoring works", "How the draw works"]],
  [`/admin/operators/${operator.id}`, ["How access works"]],
]) {
  for (const label of labels) {
    await page.goto("http://localhost:3100" + url, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: label }).click();
    await page.waitForTimeout(200);
    const bad = await page.evaluate(() => {
      const out = [];
      for (const svg of document.querySelectorAll("dialog[open] svg")) {
        const rects = [...svg.querySelectorAll("rect")].map((r) => r.getBBox());
        const vb = svg.viewBox.baseVal;
        for (const t of svg.querySelectorAll("text")) {
          const b = t.getBBox();
          if (b.x + b.width > vb.width - 1 || b.x < -1) {
            out.push(
              `OUTSIDE VIEWBOX: "${t.textContent.trim()}" ends at ${Math.round(b.x + b.width)} of ${vb.width}`,
            );
            continue;
          }
          // The smallest box whose bounds actually contain the label's start.
          const host = rects
            .filter(
              (r) =>
                b.x >= r.x - 2 &&
                b.x <= r.x + r.width + 2 &&
                b.y >= r.y - 2 &&
                b.y <= r.y + r.height + 2,
            )
            .sort((a, c) => a.width * a.height - c.width * c.height)[0];
          if (host && b.x + b.width > host.x + host.width - 4) {
            out.push(
              `OVERFLOWS BOX: "${t.textContent.trim()}" ends at ${Math.round(b.x + b.width)}, box ends ${Math.round(host.x + host.width)}`,
            );
          }
        }
      }
      return out;
    });
    console.log(
      `\n${label}: ${bad.length ? bad.length + " problems" : "all labels fit"}`,
    );
    bad.forEach((b) => console.log("  " + b));
    await page.keyboard.press("Escape");
  }
}
await browser.close();
