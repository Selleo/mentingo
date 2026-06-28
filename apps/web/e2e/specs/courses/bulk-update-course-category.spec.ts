import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkCourseCategoryFlow } from "../../flows/courses/confirm-bulk-course-category.flow";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openBulkCourseCategoryDialogFlow } from "../../flows/courses/open-bulk-course-category-dialog.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { selectCoursesFlow } from "../../flows/courses/select-courses.flow";

test("admin can bulk update course category from the courses list", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const originalCategory = await categoryFactory.create(`Bulk Category Original ${Date.now()}`);
    const targetCategory = await categoryFactory.create(`Bulk Category Target ${Date.now()}`);
    const prefix = `bulk-category-course-${Date.now()}`;
    const courses = await courseFactory.createMany(2, (index) => ({
      title: `${prefix}-${index}`,
      categoryId: originalCategory.id,
      status: "draft",
    }));

    cleanup.add(async () => {
      await courseFactory.deleteMany(courses.map((course) => course.id));
      await categoryFactory.deleteMany([originalCategory.id, targetCategory.id]);
    });

    await openCoursesPageFlow(page);
    await filterCoursesFlow(page, { title: prefix });
    await selectCoursesFlow(
      page,
      courses.map((course) => course.id),
    );
    await openBulkCourseCategoryDialogFlow(page, targetCategory.id);
    await confirmBulkCourseCategoryFlow(page);

    await expect
      .poll(async () => {
        const updatedCourses = await Promise.all(
          courses.map((course) => courseFactory.getById(course.id)),
        );

        return updatedCourses.every((course) => course.categoryId === targetCategory.id);
      })
      .toBe(true);
  });
});
