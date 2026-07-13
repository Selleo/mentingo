import { USER_ROLE } from "~/config/userRoles";

import { GLOBAL_SEARCH_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openGlobalSearchFlow } from "../../flows/navigation/open-global-search.flow";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";

test("student can find a published course via global search and open it", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();

  let courseId = "";
  let courseTitle = "";
  let coursePathTitle = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      const category = await categoryFactory.create(`global-search-category-${Date.now()}`);
      const course = await courseFactory.create({
        title: `E2E Global Search Course ${Date.now()}`,
        categoryId: category.id,
        status: "published",
      });
      courseId = course.id;
      courseTitle = course.title;
      coursePathTitle = course.title.toLowerCase().replaceAll(" ", "-");

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await courseFactory.update(course.id, { status: "draft", language: "en" });
            await courseFactory.delete(course.id);
            await categoryFactory.delete(category.id);
          },
          { root: true },
        );
      });

      await expect
        .poll(async () => {
          const response = await apiClient.api.globalSearchControllerSearch({
            searchQuery: course.title,
            language: "en",
          });
          const results = response.data.data;
          return results.availableCourses.some((item) => item.id === course.id);
        })
        .toBe(true);
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await prepareNavigationPageFlow(page);
      await openGlobalSearchFlow(page);

      await page.getByTestId(GLOBAL_SEARCH_HANDLES.INPUT).fill(courseTitle.slice(0, 2));
      await expect(
        page.getByTestId(GLOBAL_SEARCH_HANDLES.resultItem("availableCourses", courseId)),
      ).toHaveCount(0);

      await page.getByTestId(GLOBAL_SEARCH_HANDLES.INPUT).fill(courseTitle);

      const resultItem = page.getByTestId(
        GLOBAL_SEARCH_HANDLES.resultItem("availableCourses", courseId),
      );
      await expect(resultItem).toBeVisible();

      await resultItem.click();
      await expect(page).toHaveURL(new RegExp(`/course/[^/?#]*${coursePathTitle}$`));
    },
    { root: true },
  );
});

test("global search shows an empty state for an unmatched query", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await prepareNavigationPageFlow(page);
    await openGlobalSearchFlow(page);

    await page.getByTestId(GLOBAL_SEARCH_HANDLES.INPUT).fill(`no-such-result-${Date.now()}`);

    await expect(page.getByTestId(GLOBAL_SEARCH_HANDLES.EMPTY_STATE)).toBeVisible();
  });
});
