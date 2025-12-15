import { test, expect } from "@playwright/test";

import {
  enrollAllStudents,
  enrollSelected,
  findAndClickCell,
  login,
  navigateToPage,
  selectCourseAndOpenEnrollmentTab,
  verifyStudentSeesCourse,
} from "../../utils";

import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "./data/assigning-student-data";

test.describe("Assigning students to course flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should assign student to course and student sees enrollment", async ({ page }) => {
    await test.step("admin enrolls the student", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
      );

      await findAndClickCell(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail);

      await enrollSelected(page);

      await expect(
        page.getByTestId(
          new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.studentToAssignEmail, "i"),
        ),
      ).toHaveText(new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.enrolled, "i"));
    });

    await test.step("student verifies enrollment", async () => {
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
        await verifyStudentSeesCourse(
          page,
          ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.secondCourseToAssign,
        ),
      ).toBeTruthy();
    });
  });

  test("should assign multiple students to course and verify their enrollment", async ({
    page,
  }) => {
    await selectCourseAndOpenEnrollmentTab(
      page,
      ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
    );

    await enrollAllStudents(page);
  });
});
