import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCourseSettingsFlow } from "../../flows/courses/fill-course-settings.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

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

    await openCourseOverviewFlow(page, course.id);
    await fillCourseSettingsFlow(page, {
      title: updatedTitle,
      currentCategoryTitle: originalCategory.title,
      categoryTitle: updatedCategory.title,
    });
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.DETAILS_BUTTON).click();
    await fillCourseSettingsFlow(page, {
      description: updatedDescription,
    });

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
        description: updatedDescription,
      });
  });
});
