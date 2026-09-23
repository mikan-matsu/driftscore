import { expect, test } from "@playwright/test";

test("custom ensemble: generate button gates on selection, and the chosen instruments actually render", async ({ page }) => {
  await page.goto("/");

  await page.locator("section", { hasText: "1. 曲を選ぶ" }).locator("button").first().click();
  await expect(page.getByText("2. ジャンルと崩し度を決める")).toBeVisible();

  await page.getByRole("button", { name: "カスタム編成" }).click();
  await expect(page.getByText("楽器を選択")).toBeVisible();

  const generateBtn = page.getByRole("button", { name: "アレンジを生成する" });
  await expect(generateBtn).toBeDisabled();

  await page.getByRole("button", { name: "クラリネット(B♭)", exact: true }).click();
  await page.getByRole("button", { name: "ギター", exact: true }).click();
  await page.getByRole("button", { name: "エレキベース", exact: true }).click();
  await expect(generateBtn).toBeEnabled();

  await generateBtn.click();
  await expect(page.getByText("3. 結果")).toBeVisible();

  // Part tabs should reflect the chosen instruments, not a preset's defaults
  // (this is the request-shape bug this test exists to catch: instrumentIds
  // silently falling back to the pianoTrio preset if the API stops honoring it).
  const tabs = page.locator("section", { hasText: "3. 結果" }).getByRole("button");
  await expect(tabs.filter({ hasText: "Clarinet in B♭" })).toBeVisible({ timeout: 20_000 });
  await expect(tabs.filter({ hasText: "Guitar" })).toBeVisible();
  await expect(tabs.filter({ hasText: "Bass" })).toBeVisible();
  await expect(tabs.filter({ hasText: "Lead" })).toHaveCount(0);
  await expect(tabs.filter({ hasText: "Piano" })).toHaveCount(0);
});
