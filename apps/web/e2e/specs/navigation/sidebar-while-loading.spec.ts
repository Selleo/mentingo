import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";

test("sidebar stays visible while a directly opened course page loads", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Sidebar Loading Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `Sidebar Loading Course ${Date.now()}`,
      categoryId: category.id,
      language: "en",
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    let releaseCourseRequest = () => {};
    const courseRequestReleased = new Promise<void>((resolve) => {
      releaseCourseRequest = resolve;
    });

    await page.route("**/api/course?*", async (route) => {
      await courseRequestReleased;
      await route.continue();
    });

    await page.goto(`/course/${course.id}`);

    await expect(page.getByTestId(NAVIGATION_HANDLES.DASHBOARD_LINK)).toBeVisible();
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO)).toBeHidden();

    releaseCourseRequest();

    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO)).toBeVisible();
    await expect(page.getByTestId(NAVIGATION_HANDLES.DASHBOARD_LINK)).toBeVisible();
  });
});
