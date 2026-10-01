import { USER_ROLE } from "~/config/userRoles";

import {
  COURSE_OVERVIEW_HANDLES,
  COURSE_SETTINGS_HANDLES,
  COURSES_PAGE_HANDLES,
} from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { selectCoursesFlow } from "../../flows/courses/select-courses.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

import type { FixtureApiClient } from "../../utils/api-client";

const getArchivedState = async (apiClient: FixtureApiClient, courseId: string) => {
  const response = await apiClient.api.courseControllerGetAllCourses({
    language: "en",
    isArchived: "all",
    page: 1,
    perPage: 100,
  });

  return response.data.data.find((course) => course.id === courseId)?.isArchived;
};

test("admin can archive and restore courses from bulk actions", async ({
  cleanup,
  factories,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Archive Course Category ${Date.now()}`);
    const prefix = `archive-course-${Date.now()}`;
    const courses = await courseFactory.createMany(2, (index) => ({
      title: `${prefix}-${index}`,
      categoryId: category.id,
      status: "draft",
    }));

    cleanup.add(async () => {
      await courseFactory.deleteMany(courses.map((course) => course.id));
      await categoryFactory.delete(category.id);
    });

    await openCoursesPageFlow(page);
    const filteredCoursesResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith("/api/course/all") &&
        url.searchParams.get("title") === prefix &&
        response.ok()
      );
    });
    await filterCoursesFlow(page, { title: prefix });
    await filteredCoursesResponse;
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(courses[0].id))).toBeVisible();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(courses[1].id))).toBeVisible();
    await selectCoursesFlow(
      page,
      courses.map((course) => course.id),
    );
    await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER).click();
    const archiveAction = page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION);
    await expect(archiveAction).toHaveClass(/text-error-700/);
    await archiveAction.click();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG)).toBeVisible();
    await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CANCEL_BUTTON).click();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG)).toBeHidden();
    await expect.poll(() => getArchivedState(workerTenantApiClient, courses[0].id)).toBe(false);

    await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION).click();
    const archiveConfirmButton = page.getByTestId(
      COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON,
    );
    await expect(archiveConfirmButton).toHaveClass(/bg-error-500/);
    await archiveConfirmButton.click();

    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeHidden();
    }
    await expect
      .poll(async () =>
        Promise.all(courses.map(({ id }) => getArchivedState(workerTenantApiClient, id))),
      )
      .toEqual([true, true]);

    await filterCoursesFlow(page, { archivedStatus: "archived" });
    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeVisible();
    }
    await expect(
      page.getByTestId(COURSES_PAGE_HANDLES.TABLE_BODY).locator("tr[data-course-id]"),
    ).toHaveCount(2);

    await selectCoursesFlow(
      page,
      courses.map((course) => course.id),
    );
    await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON).click();

    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeHidden();
    }
    await filterCoursesFlow(page, { archivedStatus: "active" });
    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeVisible();
    }

    await page.getByTestId(COURSES_PAGE_HANDLES.rowActionsTrigger(courses[0].id)).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON).click();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(courses[0].id))).toBeHidden();

    await filterCoursesFlow(page, { archivedStatus: "archived" });
    await page.getByTestId(COURSES_PAGE_HANDLES.rowActionsTrigger(courses[0].id)).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION).click();
    await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON).click();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(courses[0].id))).toBeHidden();
  });
});

test("admin can archive and restore a course from its settings, and enrolled learners retain access", async ({
  cleanup,
  factories,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  let courseId = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const category = await categoryFactory.create(`Archive Learner Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `archive-learner-course-${Date.now()}`,
      categoryId: category.id,
      status: "published",
    });
    courseId = course.id;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });
  });

  await withWorkerPage(USER_ROLE.student, async () => {
    const enrollmentFactory = factories.createEnrollmentFactory();
    await enrollmentFactory.selfEnroll(courseId);
  });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openCourseOverviewFlow(page, courseId);
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON).click();
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER).waitFor();
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.settingsTab("status")).click();

    const archiveButton = page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_ACTION_BUTTON);
    await archiveButton.click();
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_DIALOG)).toBeVisible();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CANCEL_BUTTON).click();
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_DIALOG)).toBeHidden();
    await expect.poll(() => getArchivedState(workerTenantApiClient, courseId)).toBe(false);

    await archiveButton.click();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_BUTTON).click();
    await expect.poll(() => getArchivedState(workerTenantApiClient, courseId)).toBe(true);
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO)).toBeVisible();
  });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openCourseOverviewFlow(page, courseId);
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_BUTTON).click();
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.SETTINGS_DRAWER).waitFor();
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.settingsTab("status")).click();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_ACTION_BUTTON).click();
    await expect.poll(() => getArchivedState(workerTenantApiClient, courseId)).toBe(false);
  });
});
