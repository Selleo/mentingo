import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TAB_VALUES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCoursePreviewFlow } from "../../flows/courses/open-course-preview.flow";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";
import { toggleCourseStudentModeFlow } from "../../flows/courses/toggle-course-student-mode.flow";

test("admin can toggle student mode from course preview", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Student Mode Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `student-mode-course-${Date.now()}`,
      categoryId: category.id,
      status: "private",
    });

    cleanup.add(async () => {
      await courseFactory.setStudentMode(course.id, false);
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.SETTINGS);
    await openCoursePreviewFlow(page);
    await expect(page).toHaveURL(/\/course\//);
    await expect(page).not.toHaveURL(/\/auth\/login/);

    await toggleCourseStudentModeFlow(page);

    await expect
      .poll(async () => {
        const studentModeCourseIds = await courseFactory.getCurrentUserStudentModeCourseIds();
        return studentModeCourseIds.includes(course.id);
      })
      .toBe(true);
  });
});
