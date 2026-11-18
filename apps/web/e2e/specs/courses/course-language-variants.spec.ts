import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createCourseLanguageFlow } from "../../flows/courses/create-course-language.flow";
import { deleteCourseLanguageFlow } from "../../flows/courses/delete-course-language.flow";
import { fillCourseSettingsFlow } from "../../flows/courses/fill-course-settings.flow";
import { selectCourseLanguageFlow } from "../../flows/courses/select-course-language.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

test("admin can create, update, and delete a course language variant", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Language Course Category ${Date.now()}`);
    const baseTitle = `language-course-${Date.now()}`;
    const course = await courseFactory.create({
      title: baseTitle,
      categoryId: category.id,
      language: "en",
    });
    const translatedTitle = `German ${baseTitle}`;
    const heroTitle = page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE);

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCourseOverviewFlow(page, course.id);
    await createCourseLanguageFlow(page, "de");
    await fillCourseSettingsFlow(page, { title: translatedTitle });

    await expect
      .poll(async () => {
        const translatedCourse = await courseFactory.getById(course.id, "de");
        return {
          title: translatedCourse.title,
          hasGermanLocale: translatedCourse.availableLocales.includes("de"),
        };
      })
      .toEqual({ title: translatedTitle, hasGermanLocale: true });

    await expect(heroTitle).toHaveText(translatedTitle);
    await selectCourseLanguageFlow(page, "en");
    await expect(heroTitle).toHaveText(baseTitle);

    // Workaround for #2273: the cached "en" course keeps a stale language list after creating a variant.
    await page.reload();
    await selectCourseLanguageFlow(page, "de");
    await expect(heroTitle).toHaveText(translatedTitle);
    await deleteCourseLanguageFlow(page);

    await expect(heroTitle).toHaveText(baseTitle);
    await expect
      .poll(async () => (await courseFactory.getById(course.id, "en")).availableLocales)
      .not.toContain("de");
  });
});
