import { expect, test } from "@playwright/test";

/**
 * Regression test for a bug where OSMD's own `cursorsOptions.follow: true`
 * fired a native `scrollIntoView({block:"center"})` on every step of
 * useCursorSync's silent pre-playback measurement walk (buildLineSegments),
 * leaving the score scrolled away from the start — cutting off the title —
 * before playback even visibly began. Fixed by setting `follow: false`
 * (ScoreViewer.tsx); the manual rAF cursor loop never relied on it during
 * actual playback. Narrow viewport + full song form reproduces the
 * horizontal overflow this bug depended on.
 */
test.use({ viewport: { width: 900, height: 700 } });

test("playback does not scroll the score away from its start", async ({ page }) => {
  await page.goto("/");

  await page.locator("section", { hasText: "1. 曲を選ぶ" }).locator("button").first().click();
  await expect(page.getByText("2. ジャンルと崩し度を決める")).toBeVisible();
  await page.getByRole("button", { name: "フル構成" }).click();
  await page.getByRole("button", { name: "アレンジを生成する" }).click();

  const scoreContainer = page.locator(".overflow-x-auto").first();
  await expect(scoreContainer.locator("svg").first()).toBeVisible({ timeout: 20_000 });

  const scrollWidth = await scoreContainer.evaluate((el) => el.scrollWidth);
  const clientWidth = await scoreContainer.evaluate((el) => el.clientWidth);
  expect(scrollWidth).toBeGreaterThan(clientWidth); // sanity: this viewport/song-form actually overflows

  await page.getByRole("button", { name: /再生/ }).click();
  await page.waitForTimeout(3000);

  await expect(scoreContainer).toHaveJSProperty("scrollLeft", 0);
});
