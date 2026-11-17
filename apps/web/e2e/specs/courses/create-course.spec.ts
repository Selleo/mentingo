import { USER_ROLE } from "~/config/userRoles";

import { CREATE_COURSE_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateCourseFormFlow } from "../../flows/courses/fill-create-course-form.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { openCreateCourseFromListFlow } from "../../flows/courses/open-create-course-from-list.flow";
import { openCreateCoursePageFlow } from "../../flows/courses/open-create-course-page.flow";
import { submitCreateCourseFormFlow } from "../../flows/courses/submit-create-course-form.flow";

test("admin can create a course from the course list", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Create Course Category ${Date.now()}`);
    const title = `create-course-${Date.now()}`;

    cleanup.add(async () => {
      const createdCourse = await courseFactory.findByTitle(title);
      if (createdCourse) {
        await courseFactory.delete(createdCourse.id);
      }
      await categoryFactory.delete(category.id);
    });

    await openCoursesPageFlow(page);
    await openCreateCourseFromListFlow(page);
    await expect(page).toHaveURL(/\/admin\/beta-courses\/new\/standard$/);
    await fillCreateCourseFormFlow(page, {
      title,
      categoryTitle: category.title,
      language: "en",
      description: `Description for ${title}`,
    });
    await submitCreateCourseFormFlow(page);

    await expect
      .poll(async () => {
        const createdCourse = await courseFactory.findByTitle(title);
        return createdCourse?.id ?? null;
      })
      .not.toBeNull();

    const createdCourse = await courseFactory.findByTitle(title);

    await expect(page).toHaveURL(new RegExp(`/admin/beta-courses/${createdCourse?.id}`));
  });
});

test("admin cannot submit invalid course data", async ({ factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const courseFactory = factories.createCourseFactory();
    const title = `x`;

    await openCreateCoursePageFlow(page);
    await fillCreateCourseFormFlow(page, { title });

    await expect(page.getByTestId(CREATE_COURSE_PAGE_HANDLES.SUBMIT_BUTTON)).toBeDisabled();
    await expect(await courseFactory.findByTitle(title)).toBeNull();
  });
});
