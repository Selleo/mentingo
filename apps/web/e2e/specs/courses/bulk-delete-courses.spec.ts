import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { confirmDeleteCoursesFlow } from "../../flows/courses/confirm-delete-courses.flow";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { openDeleteCoursesDialogFlow } from "../../flows/courses/open-delete-courses-dialog.flow";
import { selectCoursesFlow } from "../../flows/courses/select-courses.flow";

test("admin can bulk delete draft courses", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Bulk Delete Course Category ${Date.now()}`);
    const prefix = `bulk-delete-course-${Date.now()}`;
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
    await openDeleteCoursesDialogFlow(page);
    await confirmDeleteCoursesFlow(page);

    await expect
      .poll(async () => {
        const remaining = await Promise.all(
          courses.map((course) => courseFactory.findByTitle(course.title)),
        );
        return remaining.every((course) => course === null);
      })
      .toBe(true);
  });
});
