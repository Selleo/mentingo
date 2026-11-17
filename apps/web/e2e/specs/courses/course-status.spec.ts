import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TAB_VALUES, COURSES_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkCourseStatusFlow } from "../../flows/courses/confirm-bulk-course-status.flow";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openBulkCourseStatusDialogFlow } from "../../flows/courses/open-bulk-course-status-dialog.flow";
import {
  openCourseOverviewSettingsFlow,
  selectCourseOverviewSettingsTabFlow,
} from "../../flows/courses/open-course-overview-settings.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { saveCourseStatusFlow } from "../../flows/courses/save-course-status.flow";
import { selectCourseStatusFlow } from "../../flows/courses/select-course-status.flow";
import { selectCoursesFlow } from "../../flows/courses/select-courses.flow";

test("admin can update course status from the course settings", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Status Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `status-course-${Date.now()}`,
      categoryId: category.id,
      status: "draft",
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.STATUS);
    await selectCourseStatusFlow(page, "private");
    await saveCourseStatusFlow(page);

    await expect.poll(async () => (await courseFactory.getById(course.id)).status).toBe("private");

    await openCoursesPageFlow(page);
    await filterCoursesFlow(page, { title: course.title, state: "private" });
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeVisible();
    await filterCoursesFlow(page, { state: "draft" });
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeHidden();
  });
});

test("admin can bulk update course status from the courses list", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Bulk Status Course Category ${Date.now()}`);
    const prefix = `bulk-status-course-${Date.now()}`;
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
    await filterCoursesFlow(page, { title: prefix, state: "draft" });
    await selectCoursesFlow(
      page,
      courses.map((course) => course.id),
    );
    await openBulkCourseStatusDialogFlow(page, "private");
    await confirmBulkCourseStatusFlow(page);

    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeHidden();
    }

    await filterCoursesFlow(page, { state: "private" });
    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeVisible();
    }
    await expect
      .poll(async () => {
        const updatedCourses = await Promise.all(
          courses.map((course) => courseFactory.getById(course.id)),
        );

        return updatedCourses.every((course) => course.status === "private");
      })
      .toBe(true);
  });
});
