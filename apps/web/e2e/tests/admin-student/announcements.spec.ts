import { expect, test, type Page } from "@playwright/test";

const USERS = {
  admin: { email: "email@example.com", password: "password" },
  student: { email: "student@example.com", password: "password" },
  student2: { email: "student0@example.com", password: "password" },
} as const;

const GROUP_NAME = "Students";
const ANNOUNCEMENT = {
  title: "New biology course!",
  body: "biology course is already accessible",
};
const TOASTS = {
  created: "Announcement created successfully",
  markedRead: "Announcements have been marked as read successfully",
};

const createGroupAndAssignStudent = async (page: Page) => {
  await page.getByRole("button", { name: "Manage" }).nth(1).click();
  await page.getByRole("link", { name: "Groups" }).click();
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByTestId("groupName").fill(GROUP_NAME);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("cell", { name: GROUP_NAME, exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Users" }).click();
  await page.getByTestId(USERS.student.email).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Change group" }).click();
  await page.getByRole("option", { name: GROUP_NAME, exact: true }).click();
  await page.getByRole("heading", { name: "Modify groups (1)" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
};

const createAnnouncementAsAdmin = async (page: Page) => {
  await page.getByRole("link", { name: "Announcements" }).click();
  await expect(page.getByRole("heading", { name: "Announcements" })).toBeVisible();
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByPlaceholder("Enter title").fill(ANNOUNCEMENT.title);
  await page.getByPlaceholder("Write your announcement here").fill(ANNOUNCEMENT.body);
  await page.getByLabel("* Group").click();
  await page.getByLabel(GROUP_NAME).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(TOASTS.created, { exact: true })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Announcements" }).click();
  await expect(page.getByRole("heading", { name: ANNOUNCEMENT.title })).toBeVisible();
};

const logoutAndLogin = async (page: Page, email: string, password: string) => {
  await page
    .getByRole("button", {
      name: /Avatar for email@example.com|Test Admin profile Test Admin|test Student profile test/i,
    })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
  await page.getByPlaceholder("user@example.com").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
};

const studentMarksAnnouncementRead = async (page: Page) => {
  await expect(page.getByText(`${ANNOUNCEMENT.title}${ANNOUNCEMENT.body}`)).toBeVisible();
  await page.locator("div:nth-child(2) > .items-center").first().click();
  await expect(page.getByText(TOASTS.markedRead, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Announcements" }).click();
  await expect(page.getByText(`${ANNOUNCEMENT.title}${ANNOUNCEMENT.body}`)).toBeVisible();
};

const student2HasNoAnnouncements = async (page: Page) => {
  await expect(page.getByText(`${ANNOUNCEMENT.title}${ANNOUNCEMENT.body}`)).not.toBeVisible();
  await page.getByRole("link", { name: "Announcements" }).click();
  await expect(page.getByText("No new announcements")).toBeVisible();
};

test.describe("Announcements flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should create announcement and verify it is visible to proper students", async ({
    page,
  }) => {
    await createGroupAndAssignStudent(page);
    await createAnnouncementAsAdmin(page);

    await logoutAndLogin(page, USERS.student.email, USERS.student.password);
    await studentMarksAnnouncementRead(page);

    await logoutAndLogin(page, USERS.student2.email, USERS.student2.password);
    await student2HasNoAnnouncements(page);
  });
});
