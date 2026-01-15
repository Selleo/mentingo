import { test, expect, type Page } from "@playwright/test";

const SEARCH_PLACEHOLDER = "Search...";
const COURSE_PREFIX = "Artificial Intelligence in";
const COURSE_FULL_STACK_TITLE = "E2E Test: Automated Course";
const STUDENT_EMAIL = "student@example.com";
const PASSWORD = "password";

const openSearch = async (page: Page) => {
  await page.getByRole("button", { name: SEARCH_PLACEHOLDER }).click();
};

const submitSearch = async (page: Page, query: string) => {
  const searchInput = page.getByPlaceholder(SEARCH_PLACEHOLDER);
  await searchInput.fill(query);
};

const submitSearchWithEnter = async (page: Page, query: string) => {
  const searchInput = page.getByPlaceholder(SEARCH_PLACEHOLDER);
  await searchInput.fill(query);
  await searchInput.press("Enter");
};

const openSearchHotkey = async (page: Page) => {
  await page.locator("body").press("ControlOrMeta+k");
};

const openCourses = async (page: Page) => {
  await page.getByRole("button", { name: "Courses" }).getByRole("link").click();
};

const login = async (page: Page, email: string) => {
  await page.getByPlaceholder("user@example.com").click();
  await page.getByPlaceholder("user@example.com").fill(email);
  await page.getByLabel("Password").click();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL("/courses");
};

const logout = async (page: Page) => {
  await page
    .getByRole("button", { name: /Avatar for email@example.com|Test Admin profile Test Admin/i })
    .click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const expectCourseVisible = async (page: Page, title: string) => {
  await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
};

const openCourseFromSearch = async (page: Page, title: string) => {
  await page.getByRole("link", { name: title }).first().click();
};

const expectCourseHeading = async (page: Page, heading: string) => {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
};

const openCourseAndExpectHeading = async (page: Page, title: string, isAdmin: boolean) => {
  await openCourseFromSearch(page, title);
  const urlPattern = isAdmin
    ? /\/admin\/beta-courses\/[0-9a-fA-F-]{36}$/
    : /\/course\/[0-9a-fA-F-]{36}$/;
  await page.waitForURL(urlPattern);
  await expectCourseHeading(page, title);
};

test.describe("Global search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should search for a course", async ({ page }) => {
    await openSearch(page);
    await submitSearch(page, "arti");
    await expectCourseVisible(page, COURSE_PREFIX);
    await openCourseAndExpectHeading(page, COURSE_PREFIX, true);

    await openCourses(page);
    await openSearchHotkey(page);
    await submitSearchWithEnter(page, "full-stack");
    await openCourseAndExpectHeading(page, COURSE_FULL_STACK_TITLE, true);

    await logout(page);
    await login(page, STUDENT_EMAIL);

    await openSearchHotkey(page);
    await submitSearch(page, "arti");
    await expectCourseVisible(page, COURSE_PREFIX);
    await openCourseAndExpectHeading(page, COURSE_PREFIX, false);
  });
});
