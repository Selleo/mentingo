import path from "path";
import { fileURLToPath } from "url";

import { expect, test, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvPath = path.resolve(__dirname, "../../data/csv/user-csv.csv");
const GROUP_NAME = "grupa pierwsza";
const IMPORT_SUCCESS_MESSAGE =
  "Import completed successfully. Imported 1 users. Skipped 0 existing users.";
const IMPORTED_USER_EMAIL = "janekk@example.com";

const goToGroups = async (page: Page) => {
  await page.getByRole("button", { name: "Manage" }).nth(1).click();
  await page.getByRole("link", { name: "Groups" }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();
};

const createGroup = async (page: Page) => {
  await goToGroups(page);
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByTestId("groupName").click();
  await page.getByTestId("groupName").fill(GROUP_NAME);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("cell", { name: GROUP_NAME })).toBeVisible();
};

const openImportUsers = async (page: Page) => {
  await page.getByRole("link", { name: "Users" }).click();
  await page.getByRole("button", { name: "Import users" }).click();
};

const uploadCsvAndImport = async (page: Page) => {
  await page.getByTestId("fileUploadInput").setInputFiles(csvPath);
  await page.getByRole("button", { name: "Import users" }).click();
};

const verifyImportedUser = async (page: Page) => {
  await expect(page.getByLabel("Imported (1)").getByText(IMPORTED_USER_EMAIL)).toBeVisible();
};

const closeImportModal = async (page: Page) => {
  await page
    .locator("div")
    .filter({ hasText: /^Close$/ })
    .getByRole("button")
    .click();
};

const verifySuccessAndGroup = async (page: Page) => {
  await expect(page.getByText(IMPORT_SUCCESS_MESSAGE, { exact: true })).toBeVisible();
  await expect(page.getByText(GROUP_NAME)).toBeVisible();
};

const logoutAdmin = async (page: Page) => {
  await page.getByRole("button", { name: "Test Admin profile Test Admin" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const createNewPasswordAndLoginAsStudent = async (page: Page) => {
  await page.goto("/auth/login");

  await page.goto("http://localhost:8025/");
  await page.getByText("noreply@mentingo.com janekk@").first().click();
  const page2Promise = page.waitForEvent("popup");
  await page
    .locator("#preview-html")
    .contentFrame()
    .getByRole("link", { name: "DOŁĄCZ TERAZ" })
    .click();
  const page2 = await page2Promise;
  await page2.getByLabel("Password", { exact: true }).click();
  await page2.getByLabel("Password", { exact: true }).fill("Pass@123");
  await page2.getByLabel("Confirm password").click();
  await page2.getByLabel("Confirm password").fill("Pass@123");
  await page2.getByRole("button", { name: "Create password" }).click();
  await page2.goto("/auth/login");
  await page2.getByPlaceholder("user@example.com").click();
  await page2.getByPlaceholder("user@example.com").fill("janekk@example.com");
  await page2.getByLabel("Password").click();
  await page2.getByLabel("Password").fill("Pass@123");
  await page2.getByRole("button", { name: "Login" }).click();
  await page2.waitForURL("/courses");
  await expect(page2.getByRole("heading", { name: "Twoje kursy" })).toBeVisible();
};

test.describe("Import students to platform", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should import students to platform", async ({ page }) => {
    await createGroup(page);
    await openImportUsers(page);
    await uploadCsvAndImport(page);
    await verifyImportedUser(page);
    await closeImportModal(page);
    await verifySuccessAndGroup(page);
    await logoutAdmin(page);
    await createNewPasswordAndLoginAsStudent(page);
  });
});
