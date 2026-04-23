import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TAB_VALUES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCourseSettingsFlow } from "../../flows/courses/fill-course-settings.flow";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";
import { saveCourseSettingsFlow } from "../../flows/courses/save-course-settings.flow";

test("admin can update course settings", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const originalCategory = await categoryFactory.create(`Original Course Category ${Date.now()}`);
    const updatedCategory = await categoryFactory.create(`Updated Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `update-course-${Date.now()}`,
      categoryId: originalCategory.id,
    });
    const updatedTitle = `updated-course-${Date.now()}`;
    const updatedDescription = `Updated description ${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.deleteMany([originalCategory.id, updatedCategory.id]);
    });

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.SETTINGS);
    await fillCourseSettingsFlow(page, {
      title: updatedTitle,
      categoryTitle: updatedCategory.title,
      description: updatedDescription,
    });
    await saveCourseSettingsFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return {
          title: updatedCourse.title,
          categoryId: updatedCourse.categoryId,
          description: updatedCourse.description,
        };
      })
      .toEqual({
        title: updatedTitle,
        categoryId: updatedCategory.id,
        description: `<p>${updatedDescription}</p>`,
      });
  });
});
