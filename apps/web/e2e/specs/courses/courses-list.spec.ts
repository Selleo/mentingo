import { USER_ROLE } from "~/config/userRoles";

import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openCourseDetailsFromListFlow } from "../../flows/courses/open-course-details-from-list.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { openCreateCourseFromListFlow } from "../../flows/courses/open-create-course-from-list.flow";

test("admin can browse, filter, and open course details", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Course List Category ${Date.now()}`);
    const prefix = `courses-list-${Date.now()}`;
    const courses = await courseFactory.createMany(2, (index) => ({
      title: `${prefix}-${index}`,
      description: `Description for ${prefix}-${index}`,
      categoryId: category.id,
      status: index === 0 ? "draft" : "private",
    }));

    cleanup.add(async () => {
      await courseFactory.deleteMany(courses.map((course) => course.id));
      await categoryFactory.delete(category.id);
    });

    await openCoursesPageFlow(page);
    await filterCoursesFlow(page, { title: prefix });

    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeVisible();
    }

    await filterCoursesFlow(page, { state: "draft" });
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(courses[0].id))).toBeVisible();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(courses[1].id))).toBeHidden();

    await filterCoursesFlow(page, { state: "all", categoryTitle: category.title });
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(courses[0].id))).toBeVisible();

    await openCourseDetailsFromListFlow(page, courses[0].id);

    await expect(page).toHaveURL(new RegExp(`/admin/beta-courses/${courses[0].id}`));
  });
});

test("admin can open create course page from course list", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openCoursesPageFlow(page);
    await openCreateCourseFromListFlow(page);

    await expect(page).toHaveURL(/\/admin\/beta-courses\/new\/standard$/);
  });
});
