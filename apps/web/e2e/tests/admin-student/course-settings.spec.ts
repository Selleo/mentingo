import { expect, test, type Page } from "@playwright/test";

import {
  enrollAllStudents,
  login,
  logout,
  navigateToPage,
  selectCourse,
  selectCourseAndOpenEnrollmentTab,
  verifyStudentSeesCourse,
} from "../../utils";

import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "./data/assigning-student-data";
import { COURSE_SETTINGS_UI } from "./data/course-settings-data";

const allowUnregisteredUsersToBrowseCourses = async (page: Page) => {
  await page.getByRole("button", { name: "Test Admin profile Test Admin" }).click();
  await page.getByRole("link", { name: /settings/i }).click();

  await page
    .getByRole("tab", { name: new RegExp(COURSE_SETTINGS_UI.button.platformCustomization, "i") })
    .click();

  const showCoursesToggle = page.getByLabel(
    new RegExp(COURSE_SETTINGS_UI.button.showCoursesToVisitors, "i"),
  );

  if (!(await showCoursesToggle.isChecked())) await showCoursesToggle.click();

  await expect(showCoursesToggle).toBeChecked();
};

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

const enterCourse = async (page: Page, courseHandle: string) => {
  const courseCard = page.getByTestId(courseHandle);

  const isVisible = await courseCard.isVisible();

  if (!isVisible) {
    return false;
  }

  await courseCard.click();

  const header = page.getByRole("link", { name: new RegExp(courseHandle, "i") });

  await header.waitFor({ state: "visible" });

  await expect(header).toHaveText(new RegExp(courseHandle, "i"));

  return header;
};

const studentEnrollToCourse = async (page: Page, courseHandle: string) => {
  const header = await enterCourse(page, courseHandle);

  if (header === false) return false;

  const enrollButton = page.getByRole("button", {
    name: new RegExp(
      `${COURSE_SETTINGS_UI.button.enrollToCourse}|${COURSE_SETTINGS_UI.button.startLearning}|${COURSE_SETTINGS_UI.button.continueLearning}`,
      "i",
    ),
  });

  await enrollButton.waitFor({ state: "visible" });

  if (await enrollButton.isVisible()) await enrollButton.click();

  return await enrollButton.isVisible();
};

test.describe("Course settings flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should publish course and verify in student view", async ({ page }) => {
    await test.step("admin publishes course", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
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
        await verifyStudentSeesCourse(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign),
      ).toBeTruthy();
    });
  });

  test("should set course as draft and verify student doesn't see it", async ({ page }) => {
    await test.step("admin drafts course", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
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
        await verifyStudentSeesCourse(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign),
      ).toBeFalsy();
    });
  });

  test("should set first chapter as freemium and check if a student can access it and check if an unregistered user must log in", async ({
    page,
  }) => {
    await test.step("admin sets course as freemium", async () => {
      await selectCourse(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign);
      await page.getByRole("tab", { name: COURSE_SETTINGS_UI.button.curriculum }).click();
      const freemiumToggle = page.locator("#freemiumToggle").first();

      if (!(await freemiumToggle.isChecked())) {
        await freemiumToggle.click();
        await page.waitForResponse(
          (response) =>
            response.url().includes("api/course/beta-course-by-id") && response.status() === 200,
        );
      }

      await expect(freemiumToggle).toBeChecked();
    });

    await test.step("admin allows unregistered users to browse courses", async () => {
      await allowUnregisteredUsersToBrowseCourses(page);
    });

    await test.step("registered user tries to access free chapter", async () => {
      await login(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.secondStudentToAssignEmail,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.data.password,
      );

      await navigateToPage(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.browseCourses,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.myCourses,
        page.getByRole("heading", {
          name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses, "i"),
        }),
      );

      await enterCourse(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.thirdCourseToAssign);

      await expect(
        page.getByRole("heading", { name: COURSE_SETTINGS_UI.header.chapterTitle2 }),
      ).toBeVisible();

      await page.getByTestId(COURSE_SETTINGS_UI.header.chapterTitle3).click();

      await page.getByRole("button", { name: "Repeat lessons" }).click();

      const nextLessonButton = page.getByTestId(
        new RegExp(COURSE_SETTINGS_UI.button.nextLesson, "i"),
      );
      await expect(nextLessonButton).toBeVisible();

      await test.step("unregistered user tries to access free chapter", async () => {
        const newPage = page;
        await page.getByRole("button", { name: "test Student profile test" }).click();
        await page
          .getByRole("menuitem", { name: /logout/i })
          .locator("div")
          .click();
        await page.waitForURL("/auth/login");
        await expect(page).toHaveURL("/auth/login");

        await newPage.goto("/courses");

        await newPage.waitForLoadState("networkidle");

        await enterCourse(newPage, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.thirdCourseToAssign);

        await newPage.waitForURL(
          /course\/[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
        );

        await page.getByText(COURSE_SETTINGS_UI.header.chapterTitle3, { exact: true }).click();

        await newPage
          .getByRole("button", { name: new RegExp(COURSE_SETTINGS_UI.button.playChapter, "i") })
          .click();

        const header = newPage.getByRole("heading", { name: new RegExp("Login") });
        await expect(header).toBeVisible();
      });
    });
  });

  test("should set course as free and check if a student can enroll and check if an unregistered user must sign up", async ({
    page,
    browser,
  }) => {
    await test.step("admin sets course as free", async () => {
      await selectCourseAndOpenEnrollmentTab(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign,
      );
      await setCourseAsFree(page);
    });

    await test.step("admin allows unregistered users to browse courses", async () => {
      await allowUnregisteredUsersToBrowseCourses(page);
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
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.myCourses,
        page.getByRole("heading", {
          name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.yourCourses, "i"),
        }),
      );

      await studentEnrollToCourse(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.thirdCourseToAssign,
      );

      const chaptersText = page.getByRole("tab", { name: "Chapters" });
      await expect(chaptersText).toBeVisible();
    });

    await test.step("unregistered user tries to enroll", async () => {
      const newPage = await logout(browser);

      await newPage.goto("/courses");
      await newPage.waitForLoadState("networkidle");
      await newPage.waitForURL("/courses");

      const header = newPage.getByRole("heading", {
        name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.availableCourses, "i"),
      });
      await expect(header).toBeVisible();

      await studentEnrollToCourse(
        newPage,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.thirdCourseToAssign,
      );

      const signupHeader = newPage.getByRole("heading", {
        name: new RegExp(COURSE_SETTINGS_UI.header.signup, "i"),
      });

      await expect(signupHeader).toBeVisible();
    });
  });
});
