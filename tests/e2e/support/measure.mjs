// Measures admin layout without looking at pictures: where the guide button
// sits, whether the modal is centred, and whether anything overflows.
//
//   pnpm test:e2e --keep -g "the skip link"
//   node tests/e2e/support/measure.mjs
//
import { chromium } from "@playwright/test";
import postgres from "postgres";

const base = "http://localhost:3100";
const storage = "test-results/e2e/auth/admin.json";

const sql = postgres(
  process.env.E2E_DATABASE_URL ??
    "postgresql://postgres@127.0.0.1:55432/ndcak_e2e",
  { max: 1, prepare: false, max_pipeline: 0 },
);
const [undrawn] = await sql`
  select tg.id from tournament_games tg
  where not exists (select 1 from rounds r where r.tournament_game_id = tg.id)
  order by tg.sort_order limit 1`;
const [operator] = await sql`
  select id from staff_profiles where role = 'SCORE_OPERATOR'
  order by created_at limit 1`;
await sql.end();

const browser = await chromium.launch();
const problems = [];

for (const width of [1440, 1024, 390]) {
  const context = await browser.newContext({
    storageState: storage,
    viewport: { width, height: 900 },
  });
  const page = await context.newPage();

  for (const url of [
    `/admin/games/${undrawn.id}`,
    `/admin/operators/${operator.id}`,
  ]) {
    await page.goto(base + url, { waitUntil: "networkidle" });

    // Every guide button should sit at the right edge of its own panel.
    const buttons = await page.getByRole("button", { name: /^How / }).all();
    console.log(`\n${width}px  ${url}  (${buttons.length} guide buttons)`);
    for (const button of buttons) {
      const label = (await button.textContent())?.trim();
      const box = await button.boundingBox();
      const panel = await button
        .locator("xpath=ancestor::section[1]")
        .boundingBox();
      if (!box || !panel) continue;
      const rightGap = Math.round(panel.x + panel.width - (box.x + box.width));
      const fromTop = Math.round(box.y - panel.y);
      console.log(
        `  "${label}"  right gap ${rightGap}px, ${fromTop}px below panel top`,
      );
      if (width >= 1024 && rightGap > 40) {
        problems.push(
          `${width}px ${url}: "${label}" is ${rightGap}px from the panel's right edge`,
        );
      }
      if (width >= 1024 && fromTop > 90) {
        problems.push(
          `${width}px ${url}: "${label}" sits ${fromTop}px below the panel top, not beside the title`,
        );
      }
    }

    // Nothing should scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (overflow > 0) {
      problems.push(
        `${width}px ${url}: page scrolls sideways by ${overflow}px`,
      );
    }

    // The open modal should be centred and inside the viewport.
    if (buttons.length > 0) {
      await buttons[0].click();
      await page.waitForTimeout(200);
      const dialog = await page.locator("dialog[open]").boundingBox();
      if (dialog) {
        const leftGap = Math.round(dialog.x);
        const rightGap = Math.round(width - (dialog.x + dialog.width));
        const off = Math.abs(leftGap - rightGap);
        console.log(
          `  modal: ${Math.round(dialog.width)}x${Math.round(dialog.height)}, gaps ${leftGap}/${rightGap}, top ${Math.round(dialog.y)}`,
        );
        if (off > 4) {
          problems.push(
            `${width}px ${url}: modal is off-centre by ${off}px (${leftGap} left, ${rightGap} right)`,
          );
        }
        if (dialog.y < 0 || dialog.y + dialog.height > 900 + 1) {
          problems.push(
            `${width}px ${url}: modal runs outside the viewport vertically`,
          );
        }
      } else {
        problems.push(`${width}px ${url}: the guide modal did not open`);
      }
      await page.keyboard.press("Escape");
    }
  }

  await context.close();
}

await browser.close();

console.log("\n--- problems ---");
console.log(problems.length ? problems.join("\n") : "none");
process.exit(problems.length ? 1 : 0);
