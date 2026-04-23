import { USER_ROLE } from "~/config/userRoles";

import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmDeleteCoursesFlow } from "../../flows/courses/confirm-delete-courses.flow";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { openDeleteCoursesDialogFlow } from "../../flows/courses/open-delete-courses-dialog.flow";
import { selectCoursesFlow } from "../../flows/courses/select-courses.flow";

test("admin can delete a draft course", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Delete Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `delete-course-${Date.now()}`,
      categoryId: category.id,
      status: "draft",
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCoursesPageFlow(page);
    await filterCoursesFlow(page, { title: course.title });
    await selectCoursesFlow(page, [course.id]);
    await openDeleteCoursesDialogFlow(page);
    await confirmDeleteCoursesFlow(page);

    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeHidden();
    await expect.poll(async () => await courseFactory.findByTitle(course.title)).toBeNull();
  });
});
