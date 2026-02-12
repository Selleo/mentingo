import { expect, test, type Page } from "@playwright/test";

const GROUP_NAME_PREFIX = "Grupa";
const IMPORT_SUCCESS_MESSAGE =
  "Import completed successfully. Imported 1 users. Skipped 0 existing users.";

const goToGroups = async (page: Page) => {
  await page.getByRole("button", { name: "Manage" }).nth(1).click();
  await page.getByRole("link", { name: "Groups" }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();
};

const createGroup = async (page: Page, groupName: string) => {
  await goToGroups(page);
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByTestId("groupName").click();
  await page.getByTestId("groupName").fill(groupName);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("cell", { name: groupName }).first()).toBeVisible();
};

const openImportUsers = async (page: Page) => {
  await page.getByRole("link", { name: "Users" }).click();
  await page.getByRole("button", { name: "Import users" }).click();
};

const uploadCsvAndImport = async (page: Page, csvContent: string) => {
  await page.getByTestId("fileUploadInput").setInputFiles({
    name: "user-csv.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvContent, "utf-8"),
  });
  await page.getByRole("button", { name: "Import users" }).click();
};

const verifyImportedUser = async (page: Page, importedEmail: string) => {
  await expect(page.getByLabel("Imported (1)").getByText(importedEmail)).toBeVisible();
};

const closeImportModal = async (page: Page) => {
  await page
    .locator("div")
    .filter({ hasText: /^Close$/ })
    .getByRole("button")
    .click();
};

const verifySuccessAndGroup = async (page: Page, groupName: string) => {
  await expect(page.getByText(IMPORT_SUCCESS_MESSAGE, { exact: true })).toBeVisible();
  await expect(page.getByText(groupName).first()).toBeVisible();
};

const logoutAdmin = async (page: Page) => {
  await page
    .getByRole("button", { name: /Test Admin profile Test Admin|Avatar for email@example.com/i })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const createNewPasswordAndLoginAsStudent = async (page: Page, importedEmail: string) => {
  await page.goto("/auth/login");
  await page.goto("http://localhost:8025/");

  const messageRow = page.getByText(`noreply@lms.selleo.app ${importedEmail} Zapraszamy`).first();
  await expect(messageRow).toBeVisible({ timeout: 90_000 });
  await messageRow.click();

  const inviteLinkLocator = page
    .locator("#preview-html")
    .contentFrame()
    .locator("a[href*='/auth/create-new-password?createToken=']")
    .first();
  await expect(inviteLinkLocator).toBeVisible({ timeout: 15_000 });
  const inviteLink = await inviteLinkLocator.getAttribute("href");

  if (!inviteLink) throw new Error(`Invite link not found for ${importedEmail}`);

  const page2 = await page.context().newPage();
  await page2.goto(inviteLink);
  await page2.getByLabel("Password", { exact: true }).click();
  await page2.getByLabel("Password", { exact: true }).fill("Pass@123");
  await page2.getByLabel("Confirm password").click();
  await page2.getByLabel("Confirm password").fill("Pass@123");
  await page2.getByRole("button", { name: "Create password" }).click();
  await page2.goto("/auth/login");
  await page2.getByPlaceholder("user@example.com").click();
  await page2.getByPlaceholder("user@example.com").fill(importedEmail);
  await page2.getByLabel("Password").click();
  await page2.getByLabel("Password").fill("Pass@123");
  await page2.getByRole("button", { name: "Login" }).click();
  await page2.waitForURL("/courses");
  await expect(
    page2.getByRole("heading", { name: "Top 5 najpopularniejszych kursów" }),
  ).toBeVisible();
};

test.describe("Import students to platform", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should import students to platform", async ({ page }, testInfo) => {
    const runId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}`;
    const importedEmail = `janekk+import-${runId}@example.com`;
    const groupName = `${GROUP_NAME_PREFIX} ${runId}`;
    const csvContent = `firstName;lastName;email;role;groups;language\nJanek;Kowalski;${importedEmail};student;${groupName};pl`;

    await createGroup(page, groupName);
    await openImportUsers(page);
    await uploadCsvAndImport(page, csvContent);
    await verifyImportedUser(page, importedEmail);
    await closeImportModal(page);
    await verifySuccessAndGroup(page, groupName);
    await logoutAdmin(page);
    await createNewPasswordAndLoginAsStudent(page, importedEmail);
  });
});
