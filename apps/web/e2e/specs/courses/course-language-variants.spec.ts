import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TAB_VALUES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createCourseLanguageFlow } from "../../flows/courses/create-course-language.flow";
import { deleteCourseLanguageFlow } from "../../flows/courses/delete-course-language.flow";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";
import { selectCourseLanguageFlow } from "../../flows/courses/select-course-language.flow";

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
    const translatedDescription = `German description ${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.SETTINGS);
    await createCourseLanguageFlow(page, "de");
    await courseFactory.update(course.id, {
      language: "de",
      title: translatedTitle,
      description: `<p>${translatedDescription}</p>`,
    });

    await expect
      .poll(async () => {
        const translatedCourse = await courseFactory.getById(course.id, "de");
        return {
          title: translatedCourse.title,
          description: translatedCourse.description,
          hasGermanLocale: translatedCourse.availableLocales.includes("de"),
        };
      })
      .toEqual({
        title: translatedTitle,
        description: `<p>${translatedDescription}</p>`,
        hasGermanLocale: true,
      });

    await selectCourseLanguageFlow(page, "en");

    await expect
      .poll(async () => {
        const baseCourse = await courseFactory.getById(course.id, "en");
        return baseCourse.title;
      })
      .toBe(baseTitle);

    await selectCourseLanguageFlow(page, "de");
    await deleteCourseLanguageFlow(page);

    await expect
      .poll(async () => {
        const baseCourse = await courseFactory.getById(course.id, "en");
        return baseCourse.availableLocales.includes("de");
      })
      .toBe(false);
  });
});
