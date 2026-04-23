import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createCourseLanguageFlow } from "../../flows/courses/create-course-language.flow";
import { selectCourseLanguageFlow } from "../../flows/courses/select-course-language.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { updateChapterFlow } from "../../flows/curriculum/update-chapter.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("curriculum structure is locked in non-base language while translations can be edited", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-language-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const baseTitle = `base-chapter-${Date.now()}`;
    const germanTitle = `german-chapter-${Date.now()}`;
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: baseTitle,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await createCourseLanguageFlow(page, "de");
    await courseFactory.update(course.id, {
      language: "de",
      title: `German ${course.title}`,
      description: `<p>German description ${Date.now()}</p>`,
    });
    await selectCourseLanguageFlow(page, "de");

    await expect(page.getByTestId(CURRICULUM_HANDLES.ADD_CHAPTER_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(CURRICULUM_HANDLES.addLessonButton(chapter.id))).toBeDisabled();

    await updateChapterFlow(page, chapter.id, germanTitle);
    await expect
      .poll(async () => {
        const translatedCourse = await courseFactory.getById(course.id, "de");
        return translatedCourse.chapters.find((item) => item.id === chapter.id)?.title;
      })
      .toBe(germanTitle);
    await expect
      .poll(async () => {
        const baseCourse = await courseFactory.getById(course.id, "en");
        return baseCourse.chapters.find((item) => item.id === chapter.id)?.title;
      })
      .toBe(baseTitle);
  });
});
