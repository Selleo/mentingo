import { test, expect } from "@playwright/test";

test.describe("users", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should create user", async ({ page }) => {
    await page.getByRole("button", { name: "Manage" }).nth(1).click();
    await page.getByRole("link", { name: "Users" }).click();
    await page.getByRole("link", { name: "Create new" }).click();
    await page.getByLabel("First name").fill("Jacek");
    await page.getByLabel("Last name").click();
    await page.getByLabel("Last name").fill("Kowalski");
    await page.getByLabel("Email").click();
    await page.getByLabel("Email").fill("jkexample@example.com");
    await page.getByRole("button", { name: "Create user" }).click();
    await page.getByPlaceholder("Select groups").click();
    await page.getByText("UsersUser detailsUser").click();
    await page.getByRole("main").getByRole("link", { name: "Users" }).click();
    await expect(page.getByRole("cell", { name: "jkexample@example.com" })).toBeVisible();
  });
});
