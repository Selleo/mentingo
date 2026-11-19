import { USER_ROLE } from "~/config/userRoles";

import { CONTENT_LESSON_FORM_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillContentLessonFormFlow } from "../../flows/curriculum/fill-content-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveContentLessonFormFlow } from "../../flows/curriculum/save-content-lesson-form.flow";

import { arrangeCurriculumChapter } from "./curriculum-test-helpers";

test("admin can create, update, and delete a content lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `curriculum-content-${Date.now()}`;
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    const curriculumFactory = factories.createCurriculumFactory();
    const lessonTitle = `${prefix}-lesson`;
    const updatedLessonTitle = `${prefix}-updated-lesson`;

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "content");
    await fillContentLessonFormFlow(page, {
      title: lessonTitle,
      description: `Content body ${prefix}`,
    });
    await saveContentLessonFormFlow(page);

    await expect
      .poll(
        async () => (await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle))?.id,
      )
      .toBeDefined();
    const lessonId =
      (await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle))?.id ?? "";
    const lessonCardTitle = page.getByTestId(CURRICULUM_HANDLES.lessonTitle(lessonId));
    await expect(lessonCardTitle).toHaveText(lessonTitle);

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await fillContentLessonFormFlow(page, {
      title: updatedLessonTitle,
      description: `Updated content body ${prefix}`,
    });
    await saveContentLessonFormFlow(page);

    await expect(lessonCardTitle).toHaveText(updatedLessonTitle);
    await expect
      .poll(
        async () =>
          (await curriculumFactory.findCourseLessonByTitle(course.id, updatedLessonTitle))?.id,
      )
      .toBe(lessonId);

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await page.getByTestId(CONTENT_LESSON_FORM_HANDLES.DELETE_BUTTON).click();
    await page.getByTestId(CONTENT_LESSON_FORM_HANDLES.DELETE_CONFIRM_BUTTON).click();

    await expect(page.getByTestId(CURRICULUM_HANDLES.lessonCard(lessonId))).toBeHidden();
    await expect
      .poll(async () => curriculumFactory.findCourseLessonByTitle(course.id, updatedLessonTitle))
      .toBeNull();
  });
});
