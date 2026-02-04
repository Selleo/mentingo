import { test, expect, type Page } from "@playwright/test";

const STUDENT_EMAIL = "student2@example.com";
const ADMIN_EMAIL = "admin@example.com";
const PASSWORD = "password";

const PROFILE_BUTTON_NAME = /Avatar for email@example.com|Test Admin profile Test Admin/i;

const login = async (page: Page, email: string) => {
  await page.getByPlaceholder("user@example.com").click();
  await page.getByPlaceholder("user@example.com").fill(email);
  await page.getByLabel("Password").click();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
};

const logout = async (page: Page) => {
  await page.getByRole("button", { name: PROFILE_BUTTON_NAME }).click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const openUsers = async (page: Page) => {
  await page.getByRole("button", { name: "Manage" }).nth(1).click();
  await page.getByRole("link", { name: "Users" }).click();
};

const archiveStudent = async (page: Page) => {
  await openUsers(page);
  await page.getByTestId(STUDENT_EMAIL).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("heading", { name: "Archive user accounts (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Archive" }).click();
};

const reopenUsers = async (page: Page) => {
  await page.waitForURL("/courses");
  await page.reload();
  await page.getByRole("link", { name: "Users" }).click();
};

const showStudentRecord = async (page: Page) => {
  await page.locator("button").filter({ hasText: "Active" }).click();
  await page.getByText("Archived").click();
  await page.getByRole("cell", { name: STUDENT_EMAIL }).click();
  await expect(page.getByRole("heading", { name: "User Information" })).toBeVisible();
  await page.getByLabel("Archived").click();
  await page.getByRole("button", { name: "Save" }).click();
};

test.describe("Archive user", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should test archiving user flow", async ({ page }) => {
    await archiveStudent(page);
    await expect(page.getByRole("cell", { name: STUDENT_EMAIL })).not.toBeVisible();
    await logout(page);
    await page.waitForURL("/auth/login");

    await login(page, STUDENT_EMAIL);
    await expect(page.getByText("Your account has been archived", { exact: true })).toBeVisible();

    await login(page, ADMIN_EMAIL);
    await reopenUsers(page);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    await showStudentRecord(page);
    await expect(page.getByText("User updated successfully", { exact: true })).toBeVisible();

    await page.getByRole("main").getByRole("link", { name: "Users" }).click();
    await expect(page.getByRole("cell", { name: STUDENT_EMAIL })).toBeVisible();
    await logout(page);
    await login(page, STUDENT_EMAIL);
    await expect(page.getByRole("heading", { name: "Top 5 most popular courses" })).toBeVisible();
  });
});
