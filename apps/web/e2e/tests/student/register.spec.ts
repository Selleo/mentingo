import { test, expect } from "@playwright/test";

import { AuthFixture } from "e2e/fixture/auth.fixture";

test.describe("register page", () => {
  test.beforeEach(async ({ page }) => {
    const authFixture = new AuthFixture(page);
    await page.goto("/");
    await authFixture.logout();
    await page.goto("/auth/register");
  });

  test("register user", async ({ page }) => {
    await page.getByLabel("first name").fill("testname");
    await page.getByLabel("last name").fill("testlastname");
    await page.getByLabel("email").fill("test@useraaaa.com");
    await page.getByLabel("password").fill("Pasword123@");

    await page.route("**/auth/register", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        json: { data: { email: "", id: "", createdAt: "", updatedAt: "" } },
      });
    });

    await page.getByRole("button", { name: /create/i }).click();

    await expect(page).toHaveURL(/login/);
  });

  test("button should be disabled with weak password", async ({ page }) => {
    await page.getByLabel("first name").fill("testname");
    await page.getByLabel("last name").fill("testlastname");
    await page.getByLabel("email").fill("test@user.com");

    await page.getByLabel("password").fill("abc");

    const createButton = page.getByRole("button", { name: /create/i });
    await expect(createButton).toBeDisabled();
  });

  test("password validation indicators should update correctly", async ({ page }) => {
    await page.getByLabel("first name").fill("testname");
    await page.getByLabel("last name").fill("testlastname");
    await page.getByLabel("email").fill("test@user.com");

    const passwordInput = page.getByLabel("password");

    await expect(page.locator("svg.lucide-x")).toHaveCount(5);

    await passwordInput.fill("abc");

    await expect(page.locator("svg.lucide-x")).toHaveCount(4);
    await expect(page.locator("svg.lucide-check")).toHaveCount(1);

    await passwordInput.fill("abcdefgh");

    await expect(page.locator("svg.lucide-check")).toHaveCount(2);
    await expect(page.locator("svg.lucide-x")).toHaveCount(3);

    await passwordInput.fill("abcdefghA");

    await expect(page.locator("svg.lucide-check")).toHaveCount(3);
    await expect(page.locator("svg.lucide-x")).toHaveCount(2);

    await passwordInput.fill("Password123@");

    await expect(page.locator("svg.lucide-check")).toHaveCount(5);
    await expect(page.locator("svg.lucide-x")).toHaveCount(0);

    const createButton = page.getByRole("button", { name: /create/i });
    await expect(createButton).toBeEnabled();
  });

  test("should show email validation error", async ({ page }) => {
    await page.getByLabel("first name").fill("testname");
    await page.getByLabel("last name").fill("testlastname");
    await page.getByLabel("email").fill("invalid-email");
    await page.getByLabel("password").fill("Password123@");

    const createButton = page.getByRole("button", { name: /create/i });
    await expect(createButton).toBeDisabled();

    await expect(page.getByText("Invalid email")).toBeVisible();
  });

  test("should show required field validation", async ({ page }) => {
    await page.getByLabel("last name").fill("testlastname");
    await page.getByLabel("email").fill("test@user.com");
    await page.getByLabel("password").fill("Password123@");

    const createButton = page.getByRole("button", { name: /create/i });
    await expect(createButton).toBeDisabled();
  });

  test("password strength bars should update correctly", async ({ page }) => {
    await page.getByLabel("first name").fill("testname");
    await page.getByLabel("last name").fill("testlastname");
    await page.getByLabel("email").fill("test@user.com");

    const passwordInput = page.getByLabel("password");

    await passwordInput.fill("abc");
    await expect(page.locator(".h-2.bg-gray-200")).toHaveCount(4);

    await passwordInput.fill("abcdefgh1");
    await expect(page.locator(".h-2.bg-yellow-400")).toHaveCount(3);
    await expect(page.locator(".h-2.bg-gray-200")).toHaveCount(2);

    await passwordInput.fill("Password123@");
    await expect(page.locator(".h-2.bg-teal-500")).toHaveCount(5);
    await expect(page.locator(".h-2.bg-gray-200")).toHaveCount(0);
  });

  test("should display correct validation messages", async ({ page }) => {
    const passwordInput = page.getByLabel("password");

    await passwordInput.fill("abc");

    await expect(page.getByText("at least 8 characters")).toBeVisible();
    await expect(page.getByText("at least one lowercase letter")).toBeVisible();
    await expect(page.getByText("at least one uppercase letter")).toBeVisible();
    await expect(page.getByText("at least one number")).toBeVisible();
    await expect(page.getByText("at least one special character")).toBeVisible();
  });

  test("button should be enabled only when all fields are valid", async ({ page }) => {
    const createButton = page.getByRole("button", { name: /create/i });

    await expect(createButton).toBeDisabled();

    await page.getByLabel("first name").fill("testname");
    await expect(createButton).toBeDisabled();

    await page.getByLabel("last name").fill("testlastname");
    await expect(createButton).toBeDisabled();

    await page.getByLabel("email").fill("test@user.com");
    await expect(createButton).toBeDisabled();

    await page.getByLabel("password").fill("Password123@");
    await expect(createButton).toBeEnabled();
  });

  test("should handle edge cases correctly", async ({ page }) => {
    const passwordInput = page.getByLabel("password");
    const createButton = page.getByRole("button", { name: /create/i });

    await page.getByLabel("first name").fill("testname");
    await page.getByLabel("last name").fill("testlastname");
    await page.getByLabel("email").fill("test@user.com");

    await passwordInput.fill("Pass123@");
    await expect(page.locator("svg.lucide-check")).toHaveCount(5);
    await expect(createButton).toBeEnabled();

    await passwordInput.fill("Pass 123@");
    await expect(page.locator("svg.lucide-check")).toHaveCount(5);
    await expect(createButton).toBeEnabled();
  });

  test("should reset validation when clearing password", async ({ page }) => {
    const passwordInput = page.getByLabel("password");

    await passwordInput.fill("Password123@");
    await expect(page.locator("svg.lucide-check")).toHaveCount(5);

    await passwordInput.fill("");
    await expect(page.locator("svg.lucide-x")).toHaveCount(5);
    await expect(page.locator("svg.lucide-check")).toHaveCount(0);
  });
});
