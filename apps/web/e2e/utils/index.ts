import { expect, type Page } from "@playwright/test";

import { AuthFixture } from "../fixture/auth.fixture";
import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "../tests/admin-student/data/assigning-student-data";

export const login = async (page: Page, email: string, password: string) => {
  const authFixture = new AuthFixture(page);
  await authFixture.logout();
  await authFixture.login(email, password);
};

export const logout = async (page: Page) => {
  const authFixture = new AuthFixture(page);
  await authFixture.logout();
};

export const navigateToPage = async (page: Page, name: string, headerText: string) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();

  const header = page.getByRole("heading").first().filter({ hasText: headerText });

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

  await findAndClickCell(page, course);

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
  const enrollButton = await findButton(
    page,
    ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.enrollSelected,
  );
  await expect(enrollButton).toBeEnabled();
  await enrollButton.click();

  await (await findButton(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.save)).click();
};

export const enrollAllStudents = async (page: Page) => {
  await findAndClickCell(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.selectAll);
  await enrollSelected(page);

  await expect(
    page.getByText(new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.notEnrolled, "i")),
  ).toHaveCount(0);
};

export const verifyStudentSeesCourse = async (
  page: Page,
  course: string,
  enrolledCourse: string,
): Promise<boolean> => {
  await navigateToPage(
    page,
    ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.browseCourses,
    ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses,
  );

  const expectedCourse = page.getByTestId("enrolled-courses").getByRole("link", {
    name: new RegExp(enrolledCourse, "i"),
  });

  if (!(await expectedCourse.isVisible())) return false;

  return new RegExp(course, "i").test(await expectedCourse.innerText());
};
