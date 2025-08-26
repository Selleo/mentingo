import { test, expect } from "@playwright/test";

test("app loads and shows a heading", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/http/);

  const candidate = page.locator('[role="heading"]');
  await expect(candidate.first()).toBeVisible();
});
