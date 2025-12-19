import { test, expect } from "@playwright/test";

import { AuthFixture } from "../../fixture/auth.fixture";
import {
  enrollAllStudents,
  enrollSelected,
  findAndClickCell,
  navigateToPage,
  selectCourseAndOpenEnrollmentTab,
  verifyStudentSeesCourse,
} from "../../utils";

import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "./data/assigning-student-data";

import type { Page } from "@playwright/test";

const USERS = {
  admin: { email: "admin@example.com", password: "password" },
  student: { email: "student0@example.com", password: "password" },
};

const GROUP = { name: "STUDENTS GROUP" };

const COURSE = {
  title: "Course v1",
  categoryTestId: "category-option-Artificial Intelligence",
  categoryName: "Artificial Intelligence",
  description: "description",
};

const IDS = {
  groupSelect: /^select-group-[a-z0-9-]+$/,
};

export const login = async (page: Page, email: string, password: string) => {
  const authFixture = new AuthFixture(page);
  await authFixture.login(email, password);
};

const logout = async (page: Page) => {
  await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
};

const createGroup = async (page: Page) => {
  await page.getByRole("button", { name: "Manage" }).nth(1).click();
  await page.getByRole("link", { name: "Groups" }).click();
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByTestId("groupName").fill(GROUP.name);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("cell", { name: GROUP.name })).toBeVisible();
};

const assignGroupToStudent = async (page: Page) => {
  await page.getByRole("link", { name: "Users" }).click();
  await page.getByTestId(USERS.student.email).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Change group" }).click();
  const groupOption = page.getByRole("option", { name: GROUP.name });
  await groupOption.click();
  await expect(groupOption).toHaveAttribute("aria-selected", "true");
  await page.getByRole("heading", { name: "Modify groups (1)" }).click();
  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.getByRole("button", { name: "Confirm" }).click();
};

const createCourse = async (page: Page) => {
  await page.getByRole("link", { name: "Courses" }).click();
  await page.locator(".h-min > button:nth-child(2)").click();
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByPlaceholder("Enter title").fill(COURSE.title);
  await page.getByLabel("* Category").click();
  await page.getByTestId(COURSE.categoryTestId).getByText(COURSE.categoryName).click();
  await page.locator("#description div").fill(COURSE.description);
  await page.getByRole("button", { name: "Proceed" }).click();
};

const publishCourse = async (page: Page) => {
  await page.getByRole("tab", { name: "Status" }).click();
  await page.getByRole("button", { name: "Published Students can" }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

const enrollStudentIndividually = async (page: Page) => {
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText("student0@example.com").click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
};

const expectIndividualEnrollment = async (page: Page) => {
  await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
  await page.locator("html").click();
  await expect(page.getByRole("cell", { name: "Individually enrolled" })).toBeVisible();
};

const studentSeesCourse = async (page: Page) => {
  await login(page, USERS.student.email, USERS.student.password);
  await page.getByRole("link", { name: "Courses", exact: true }).click();
  await expect(page.getByTestId(COURSE.title)).toBeVisible();
  await page.getByTestId(COURSE.title).click();
  await expect(
    page
      .locator("div")
      .filter({ hasText: /^Artificial Intelligence$/ })
      .nth(1),
  ).toBeVisible();
  await logout(page);
};

const unenrollStudent = async (page: Page) => {
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.getByRole("link", { name: "Courses" }).click();
  await page.getByTestId(COURSE.title).click();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText("student0@example.com").click();
  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await page.getByRole("button", { name: "Unenroll selected" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await logout(page);
};

const expectCourseHiddenForStudent = async (page: Page) => {
  await login(page, USERS.student.email, USERS.student.password);
  await page.getByRole("link", { name: "Courses", exact: true }).click();
  await expect(page.getByTestId(COURSE.title)).toBeHidden();
  await logout(page);
};

const enrollGroupToCourse = async (page: Page) => {
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.getByRole("link", { name: "Courses" }).click();
  await page.getByTestId(COURSE.title).click();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText(USERS.student.email).click();
  await page.getByRole("button", { name: "Enroll groups" }).click();
  await page.getByRole("button", { name: "Enroll groups", exact: true }).click();
  await page.getByLabel("Enroll groups to course").getByText(GROUP.name).click();
  await page.getByLabel(IDS.groupSelect).click();
  await page.getByRole("button", { name: "Enroll groups" }).click();
  await expect(page.getByRole("cell", { name: "Enrolled by group" })).toBeVisible();
  await logout(page);
};

const studentSeesCourseByGroup = async (page: Page) => {
  await login(page, USERS.student.email, USERS.student.password);
  await page.getByRole("link", { name: "Courses", exact: true }).click();
  await page.getByTestId(COURSE.title).click();
  await expect(page.getByRole("heading", { name: COURSE.title })).toBeVisible();
  await logout(page);
};

const unenrollGroup = async (page: Page) => {
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.getByRole("link", { name: "Courses" }).click();
  await page.getByTestId(COURSE.title).click();
  await page.getByRole("button", { name: "Edit Course" }).click();
  await page.getByRole("tab", { name: "Enrolled students" }).click();
  await page.getByText("student0@example.com").click();
  await page.getByRole("button", { name: "Enroll groups" }).click();
  await page.getByRole("button", { name: "Unenroll groups" }).click();
  await page.getByText(`${GROUP.name}Enrolled`, { exact: true }).click();
  await page.getByLabel(IDS.groupSelect).click();
  await page.getByRole("button", { name: "Unenroll selected" }).click();
  await logout(page);
};

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

  test("should assign student/group to course and student/group sees enrollment", async ({
    page,
  }) => {
    await createGroup(page);
    await assignGroupToStudent(page);
    await createCourse(page);
    await publishCourse(page);
    await enrollStudentIndividually(page);
    await expectIndividualEnrollment(page);
    await logout(page);

    await studentSeesCourse(page);
    await unenrollStudent(page);
    await expectCourseHiddenForStudent(page);
    await enrollGroupToCourse(page);
    await studentSeesCourseByGroup(page);
    await unenrollGroup(page);
  });
});
