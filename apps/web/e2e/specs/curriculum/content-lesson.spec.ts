import { USER_ROLE } from "~/config/userRoles";

import { CONTENT_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillContentLessonFormFlow } from "../../flows/curriculum/fill-content-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveContentLessonFormFlow } from "../../flows/curriculum/save-content-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can create, update, and delete a content lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-content-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `content-chapter-${Date.now()}`,
    });
    const lessonTitle = `content-lesson-${Date.now()}`;
    const updatedLessonTitle = `updated-content-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "content");
    await fillContentLessonFormFlow(page, {
      title: lessonTitle,
      description: `Content body ${Date.now()}`,
    });
    await saveContentLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
          ?.id;
      })
      .not.toBeUndefined();

    const createdCourse = await courseFactory.getById(course.id);
    const lessonId = createdCourse.chapters[0]!.lessons!.find(
      (lesson) => lesson.title === lessonTitle,
    )!.id;

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await fillContentLessonFormFlow(page, {
      title: updatedLessonTitle,
      description: `Updated content body ${Date.now()}`,
    });
    await saveContentLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.id === lessonId)?.title;
      })
      .toBe(updatedLessonTitle);

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await page.getByTestId(CONTENT_LESSON_FORM_HANDLES.DELETE_BUTTON).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.some((lesson) => lesson.id === lessonId);
      })
      .toBe(false);
  });
});
