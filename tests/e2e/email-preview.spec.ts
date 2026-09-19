import { expect, test } from "@playwright/test";

const states = [
  "pending",
  "confirmed",
  "rejected",
  "reminder",
  "schedule",
  "support",
  "invitation",
] as const;

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test.describe(`${viewport.width}px email preview`, () => {
    test.use({ viewport });

    for (const state of states) {
      test(`${state} fits without clipping or horizontal overflow`, async ({
        page,
      }) => {
        await page.goto(`/dev/email-preview?state=${state}`);
        const frame = page.locator("iframe");

        await expect(
          page.frameLocator("iframe").getByText("Need help?"),
        ).toBeVisible();
        await expect
          .poll(async () =>
            frame.evaluate(
              (element) =>
                element.clientHeight >=
                (element as HTMLIFrameElement).contentDocument!.documentElement
                  .scrollHeight,
            ),
          )
          .toBe(true);

        const hasOverflow = await page.evaluate(() => {
          const frame = document.querySelector("iframe")!;
          return (
            document.documentElement.scrollWidth >
              document.documentElement.clientWidth ||
            frame.contentDocument!.body.scrollWidth > frame.clientWidth
          );
        });

        expect(hasOverflow).toBe(false);
      });
    }
  });
}
