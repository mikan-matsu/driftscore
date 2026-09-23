import { expect, test } from "@playwright/test";

test("golden path: pick a song, generate with defaults, score renders", async ({ page }) => {
  await page.goto("/");

  await page.locator("section", { hasText: "1. 曲を選ぶ" }).locator("button").first().click();
  await expect(page.getByText("2. ジャンルと崩し度を決める")).toBeVisible();

  await page.getByRole("button", { name: "アレンジを生成する" }).click();
  await expect(page.getByText("3. 結果")).toBeVisible();

  // The score container renders one <svg> per OSMD page once generation succeeds.
  await expect(page.locator(".overflow-x-auto svg").first()).toBeVisible({ timeout: 20_000 });
});
