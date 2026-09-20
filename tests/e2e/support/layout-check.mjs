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

for (const url of [
  `/admin/games/${undrawn.id}`,
  `/admin/operators/${operator.id}`,
]) {
  await page.goto("http://localhost:3100" + url, { waitUntil: "networkidle" });
  console.log("\n===", url);

  const report = await page.evaluate(() => {
    const out = [];
    const groups = new Map();
    // Anything that looks like a selectable tile.
    for (const el of document.querySelectorAll("label")) {
      if (!el.querySelector('input[type="radio"], input[type="checkbox"]'))
        continue;
      const parent = el.parentElement;
      if (!parent) continue;
      const list = groups.get(parent) ?? [];
      list.push(el);
      groups.set(parent, list);
    }
    for (const [, items] of groups) {
      if (items.length < 2) continue;
      const rows = new Map();
      for (const item of items) {
        const b = item.getBoundingClientRect();
        const key = Math.round(b.top / 6);
        (rows.get(key) ?? rows.set(key, []).get(key)).push({
          text: (item.textContent ?? "").trim().slice(0, 28),
          h: Math.round(b.height),
          w: Math.round(b.width),
        });
      }
      for (const [, row] of rows) {
        if (row.length < 2) continue;
        const heights = row.map((r) => r.h);
        const spread = Math.max(...heights) - Math.min(...heights);
        if (spread > 2) {
          out.push(
            `TILE HEIGHTS differ by ${spread}px in one row: ` +
              row.map((r) => `"${r.text}" ${r.h}px`).join(", "),
          );
        }
      }
      // Same group, different rows: report the spread too.
      const all = items.map((i) =>
        Math.round(i.getBoundingClientRect().height),
      );
      const spread = Math.max(...all) - Math.min(...all);
      if (spread > 2 && rows.size > 1) {
        out.push(
          `TILE HEIGHTS across the group vary by ${spread}px: ${all.join(", ")}`,
        );
      }
    }

    // Visible list markers.
    for (const el of document.querySelectorAll("ul, ol, li")) {
      const s = getComputedStyle(el);
      if (
        s.listStyleType !== "none" &&
        s.display !== "none" &&
        el.offsetParent
      ) {
        out.push(
          `LIST MARKER "${s.listStyleType}" on <${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim().slice(0, 40)}"`,
        );
      }
    }

    // Gaps between panels.
    const panels = [...document.querySelectorAll("section")]
      .map((p) => p.getBoundingClientRect())
      .filter((b) => b.height > 40)
      .sort((a, b) => a.top - b.top);
    const gaps = [];
    for (let i = 1; i < panels.length; i += 1) {
      gaps.push(
        Math.round(panels[i].top - (panels[i - 1].top + panels[i - 1].height)),
      );
    }
    if (new Set(gaps).size > 1)
      out.push(`PANEL GAPS vary: ${gaps.join(", ")}px`);
    return out;
  });

  console.log(report.length ? report.join("\n") : "nothing flagged");
}
await browser.close();
