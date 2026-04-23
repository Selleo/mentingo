import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TAB_VALUES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";
import { saveCourseStatusFlow } from "../../flows/courses/save-course-status.flow";
import { selectCourseStatusFlow } from "../../flows/courses/select-course-status.flow";

test("admin can update course status", async ({ cleanup, factories, withWorkerPage }) => {
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

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.STATUS);
    await selectCourseStatusFlow(page, "private");
    await saveCourseStatusFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.status;
      })
      .toBe("private");
  });
});
