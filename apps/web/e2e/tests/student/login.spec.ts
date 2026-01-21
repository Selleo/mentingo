import { test, expect } from "@playwright/test";

test.describe("login page", () => {
  test("should redirect to home from login page when logged in", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForURL("/courses");
    await expect(page).toHaveURL("/courses");
  });
});
