import { expect, test, type Page } from "@playwright/test";

import {
  enrollAllStudents,
  login,
  logout,
  navigateToPage,
  selectCourseAndOpenEnrollmentTab,
  verifyStudentSeesCourse,
} from "../../utils";

import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "./data/assigning-student-data";
import { COURSE_SETTINGS_UI } from "./data/course-settings-data";

const setCourseStatus = async (page: Page, status: string) => {
  await page.getByRole("tab", { name: COURSE_SETTINGS_UI.button.status }).click();
  await page.getByLabel(status).click();
  await page.getByRole("button", { name: ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.save }).click();

  await expect(
    page
      .getByRole("status", { includeHidden: true })
      .getByText(COURSE_SETTINGS_UI.messages.courseUpdatedSuccessfully, { exact: true }),
  ).toBeVisible();
};

const setCourseAsFree = async (page: Page) => {
  await page.getByRole("tab", { name: COURSE_SETTINGS_UI.button.pricing }).click();
  await page.getByLabel(COURSE_SETTINGS_UI.button.pricing).click();
  await page.getByRole("button", { name: ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.save }).click();

  await expect(
    page
      .getByRole("status", { includeHidden: true })
      .getByText(COURSE_SETTINGS_UI.messages.courseUpdatedSuccessfully, { exact: true }),
  ).toBeVisible();
};

const studentEnrollToCourse = async (page: Page, courseHandle: string, courseName: string) => {
  const courseCard = page
    .getByTestId("unenrolled-courses")
    .getByRole("link", { name: courseHandle })
    .getByRole("button");

  if (!(await courseCard.isVisible())) {
    return true;
  }

  await courseCard.click();

  const header = page.getByRole("link", { name: new RegExp(courseName, "i") });

  await header.waitFor({ state: "visible" });

  await expect(header).toHaveText(new RegExp(courseName, "i"));

  const enrollButton = page.getByRole("button", {
    name: new RegExp(COURSE_SETTINGS_UI.button.enrollToCourse, "i"),
  });

  await enrollButton.waitFor({ state: "visible" });

  if (await enrollButton.isVisible()) await enrollButton.click();

  return !(await enrollButton.isVisible()) && header.isVisible();
};

test.describe("Course settings flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should publish course and verify in student view", async ({ page }) => {
    await test.step("admin publishes course", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.secondCourseToAssign,
      );
      await enrollAllStudents(page);
      await setCourseStatus(page, COURSE_SETTINGS_UI.button.published);
    });

    await test.step("student sees course", async () => {
      await login(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.password,
      );

      expect(
        await verifyStudentSeesCourse(
          page,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.secondCourseToAssign,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.secondEnrolledCourse,
        ),
      ).toBeTruthy();
    });
  });

  test("should set course as draft and verify student doesn't see it", async ({ page }) => {
    await test.step("admin drafts course", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.secondCourseToAssign,
      );
      await enrollAllStudents(page);
      await setCourseStatus(page, COURSE_SETTINGS_UI.button.draft);
    });

    await test.step("student doesn't see course", async () => {
      await login(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.password,
      );

      expect(
        await verifyStudentSeesCourse(
          page,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.secondCourseToAssign,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.secondEnrolledCourse,
        ),
      ).toBeFalsy();
    });
  });

  test("should set course as free and check if a student can enroll and check if an unregistered user must sign up", async ({
    page,
  }) => {
    await test.step("admin sets course as free", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
      );
      await setCourseAsFree(page);
    });

    await test.step("admin allows unregistered users to browse courses", async () => {
      await navigateToPage(
        page,
        COURSE_SETTINGS_UI.button.settings,
        COURSE_SETTINGS_UI.header.settings,
      );

      await page
        .getByRole("tab", { name: new RegExp(COURSE_SETTINGS_UI.button.organization, "i") })
        .click();

      const showCoursesToggle = page.getByLabel(
        new RegExp(COURSE_SETTINGS_UI.button.showCoursesToVisitors, "i"),
      );

      if (!(await showCoursesToggle.isChecked())) await showCoursesToggle.click();

      await expect(showCoursesToggle).toBeChecked();
    });

    await test.step("student enrolls to course", async () => {
      await login(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.password,
      );

      await navigateToPage(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.browseCourses,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses,
      );

      expect(
        await studentEnrollToCourse(
          page,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.thirdEnrolledCourse,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.thirdCourseToAssign,
        ),
      ).toBeTruthy();
    });

    await test.step("unregistered user tries to enroll", async () => {
      await logout(page);

      await page.goto("/courses");

      const header = page.getByRole("heading", {
        name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.availableCourses, "i"),
      });
      await expect(header).toBeVisible();

      await studentEnrollToCourse(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.thirdEnrolledCourse,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.thirdCourseToAssign,
      );

      const signupHeader = page.getByRole("heading", {
        name: new RegExp(COURSE_SETTINGS_UI.header.signup, "i"),
      });

      await expect(signupHeader).toBeVisible();
    });
  });
});
