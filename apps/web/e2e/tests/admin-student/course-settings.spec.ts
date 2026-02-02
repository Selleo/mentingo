import { expect, test, type Page } from "@playwright/test";

import {
  enrollAllStudents,
  login,
  navigateToPage,
  selectCourse,
  selectCourseAndOpenEnrollmentTab,
  verifyStudentSeesCourse,
} from "../../utils";

import { ASSIGNING_STUDENT_TO_GROUP_PAGE_UI } from "./data/assigning-student-data";
import { COURSE_SETTINGS_UI } from "./data/course-settings-data";

const allowUnregisteredUsersToBrowseCourses = async (page: Page) => {
  await page
    .getByRole("button", { name: /Test Admin profile Test Admin|Avatar for email@example.com/i })
    .click();
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
  const courseCard = page.getByTestId(courseHandle).first();

  const isVisible = await courseCard.isVisible();

  if (!isVisible) {
    return false;
  }

  await courseCard.click();

  await page.waitForURL(/course\/[\w-]+/);

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
      const notEnrolledStudents = page.getByRole("cell", { name: /Not enrolled/i });
      if ((await notEnrolledStudents.count()) > 0) {
        await notEnrolledStudents.first().click();
        await page.getByRole("button", { name: "Enroll", exact: true }).click();
        await page.getByRole("button", { name: "Enroll selected", exact: true }).click();
        await page.getByRole("button", { name: "Save" }).click();
      }
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
    await test.step("admin sets course as freemium and published", async () => {
      await selectCourse(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign);

      await page.getByRole("tab", { name: "Status" }).click();
      await page.getByLabel("Published").click();
      await page.getByRole("button", { name: "Save" }).click();

      await expect(
        page
          .getByRole("status", { includeHidden: true })
          .getByText("Course updated successfully", { exact: true }),
      ).toBeVisible();

      await page.getByRole("tab", { name: COURSE_SETTINGS_UI.button.curriculum }).click();
      const freemiumToggle = page.locator("#freemiumToggle").first();

      if (!(await freemiumToggle.isChecked())) {
        const [response] = await Promise.all([
          page.waitForResponse(
            (res) => res.url().includes("/api/course/beta-course-by-id") && res.status() === 200,
            { timeout: 45000 },
          ),
          freemiumToggle.click(),
        ]);
        expect(response.ok()).toBeTruthy();
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
          name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.sectionHeader, "i"),
        }),
      );

      await enterCourse(page, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign);

      await expect(
        page.getByRole("heading", { name: COURSE_SETTINGS_UI.header.courseTitle }),
      ).toBeVisible();

      await page.getByTestId(COURSE_SETTINGS_UI.header.chapterTitle4).click();

      await page.getByRole("button", { name: /Repeat lessons|Play chapter/i }).click();

      const nextLessonButton = page.getByTestId(
        new RegExp(COURSE_SETTINGS_UI.button.nextLesson, "i"),
      );
      await expect(nextLessonButton).toBeVisible();

      await test.step("unregistered user tries to access free chapter", async () => {
        const newPage = page;
        await page
          .getByRole("button", { name: /test Student profile test|Avatar for email@example.com/i })
          .click();
        await page
          .getByRole("menuitem", { name: /logout/i })
          .locator("div")
          .click();
        await page.waitForURL("/auth/login");
        await expect(page).toHaveURL("/auth/login");

        await newPage.goto("/courses");

        const coursesHeader = page.getByRole("heading", { name: "Top 5 most popular courses" });
        await coursesHeader.waitFor({ state: "visible" });
        await expect(coursesHeader).toBeVisible();

        await enterCourse(newPage, ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.courseToAssign);

        await newPage.waitForURL(/\/course\/.+/);

        await page.getByText(COURSE_SETTINGS_UI.header.chapterTitle4, { exact: true }).click();

        await newPage.getByRole("button", { name: /Repeat lessons|Play chapter/i }).click();

        const header = newPage.getByRole("heading", { name: new RegExp("Login") });
        await expect(header).toBeVisible();
      });
    });
  });

  test("should set course as free and check if a student can enroll and check if an unregistered user must sign up", async ({
    page,
  }) => {
    await page.goto("/courses");
    await page
      .getByRole("button", { name: /Avatar for email@example.com|Test Admin profile Test Admin/i })
      .click();
    await page.getByRole("link", { name: "Settings" }).click();
    await page.waitForURL("/settings");
    await page.getByText("LanguageEnglish").getByRole("combobox").click();
    await page.getByLabel("English").getByText("English").click();
    await page.getByLabel("Go to homepage").click();

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

      await page
        .getByRole("button", {
          name: /Avatar for email@example.com|Test Admin profile Test Admin/i,
        })
        .click();
      await page.getByRole("link", { name: /Settings|Ustawienia/i }).click();
      await page.waitForURL("/settings");
      await page
        .getByText(/LanguageEnglish|JęzykPolski/)
        .getByRole("combobox")
        .click();

      await page
        .getByLabel("English")
        .getByText("English")
        .or(page.getByRole("option", { name: "Angielski" }))
        .click();
      await page.getByLabel("Go to homepage").click();

      await navigateToPage(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.browseCourses,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.button.myCourses,
        page.getByRole("heading", {
          name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.sectionHeader, "i"),
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
      await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
      await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
      await page.waitForURL("/auth/login");
      await expect(page).toHaveURL("/auth/login");

      await page.goto("/courses");
      await page.waitForURL("/courses");

      const header = page.getByRole("heading", {
        name: new RegExp(ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.header.sectionHeader, "i"),
      });
      await expect(header).toBeVisible();

      await studentEnrollToCourse(
        page,
        ASSIGNING_STUDENT_TO_GROUP_PAGE_UI.cell.thirdCourseToAssign,
      );

      const signupHeader = page.getByRole("heading", { name: /Sign Up|Login/i });
      await expect(signupHeader).toBeVisible();
    });
  });
});
