import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkCourseStatusFlow } from "../../flows/courses/confirm-bulk-course-status.flow";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openBulkCourseStatusDialogFlow } from "../../flows/courses/open-bulk-course-status-dialog.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { selectCoursesFlow } from "../../flows/courses/select-courses.flow";

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
    await filterCoursesFlow(page, { title: prefix });
    await selectCoursesFlow(
      page,
      courses.map((course) => course.id),
    );
    await openBulkCourseStatusDialogFlow(page, "private");
    await confirmBulkCourseStatusFlow(page);

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
