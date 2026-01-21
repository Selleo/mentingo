import { type Browser, expect, type Page, type Locator } from "@playwright/test";

import { AuthFixture } from "../fixture/auth.fixture";
import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "../tests/admin-student/data/assigning-student-data";

export const login = async (page: Page, email: string, password: string) => {
  const authFixture = new AuthFixture(page);
  await authFixture.logout();
  await authFixture.login(email, password);
};

export const logout = async (browser: Browser) => {
  const newPage = await browser.newPage();
  await newPage.context().clearCookies();

  return newPage;
};

export const navigateToPage = async (
  page: Page,
  name: string,
  headerText: string,
  headerItem?: Locator,
) => {
  const announcementsButton = page
    .getByRole("link", { name: /announcements/i })
    .waitFor({ state: "visible", timeout: 5000 })
    .catch(() => null);

  if (!announcementsButton) {
    await page
      .getByRole("button", { name: /manage/i })
      .first()
      .click();
  }

  await page.getByRole("button", { name: new RegExp(name, "i") }).click();

  const header =
    headerItem ||
    page
      .getByRole("button")
      .first()
      .filter({ hasText: new RegExp(headerText, "i") })
      .getByRole("link");

  await header.waitFor({ state: "visible" });

  await expect(header).toHaveText(new RegExp(headerText, "i"));
};

export const findAndClickCell = async (page: Page, name: string) => {
  await page
    .getByRole("cell", { name: new RegExp(name, "i") })
    .first()
    .click();
};

export const findButton = async (page: Page, name: string) => {
  return page.getByRole("button", { name: new RegExp(name, "i") }).first();
};

export const fillAndAssertTextField = async (page: Page, testId: string, valueToFill: string) => {
  const field = page.getByTestId(testId);
  await field.fill(valueToFill);
  await expect(field).toHaveValue(valueToFill);
};

export const findAndAssertCell = async (page: Page, expectedValue: string) => {
  const field = page.getByRole("cell", { name: new RegExp(expectedValue, "i") }).first();
  await expect(field).toHaveText(expectedValue);
};

export const findAndClickButton = async (page: Page, name: string) =>
  await page
    .getByRole("button", { name: new RegExp(name, "i") })
    .first()
    .click();

export const selectCourse = async (page: Page, course: string) => {
  await page
    .getByRole("button", {
      name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.myCourses, "i"),
    })
    .click();

  await page.locator(".h-min > button:nth-child(2)").click();
  await page.waitForURL("/admin/courses");
  await page.getByText("Advanced English: Mastering").click();

  const header = page.getByRole("link", {
    name: new RegExp(course, "i"),
  });

  await expect(header).toHaveText(new RegExp(course, "i"));
};

export const selectCourseAndOpenEnrollmentTab = async (page: Page, course: string) => {
  await selectCourse(page, course);

  await page
    .getByRole("tab", {
      name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.enrolledStudents, "i"),
    })
    .click();
};

export const enrollSelected = async (page: Page) => {
  const dropdown = page.getByRole("button", {
    name: ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.enroll,
    exact: true,
  });

  await dropdown.click();

  const enrollButton = await findButton(
    page,
    ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.enrollSelected,
  );
  await expect(enrollButton).toBeEnabled();
  await enrollButton.click();

  await (await findButton(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.save)).click();
};

export const enrollAllStudents = async (page: Page) => {
  const selectAllCheckbox = page.getByLabel(
    new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.selectAll, "i"),
  );

  if (!(await selectAllCheckbox.isChecked())) await selectAllCheckbox.click();
  await expect(selectAllCheckbox).toBeChecked();

  await enrollSelected(page);

  await expect(
    page.getByText(new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.notEnrolled, "i")),
  ).toHaveCount(0);
};

export const verifyStudentSeesCourse = async (page: Page, course: string): Promise<boolean> => {
  await navigateToPage(
    page,
    ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.browseCourses,
    ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses,
    page.getByRole("heading", {
      name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses, "i"),
    }),
  );

  const expectedCourse = page.getByTestId(course);

  if (!(await expectedCourse.isVisible())) return false;

  return new RegExp(course, "i").test(await expectedCourse.innerText());
};
