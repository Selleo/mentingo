import { USER_ROLE } from "~/config/userRoles";

import { SCORM_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { SCORM_TEST_DATA } from "../../data/scorm/scorm.data";
import { expect, test } from "../../fixtures/test.fixture";
import { fillScormLessonFormFlow } from "../../flows/curriculum/fill-scorm-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveScormLessonFormFlow } from "../../flows/curriculum/save-scorm-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can create, inspect, and delete a SCORM lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-scorm-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `scorm-chapter-${Date.now()}`,
    });
    const lessonTitle = `scorm-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "scorm");
    await expect(page.getByTestId(SCORM_LESSON_FORM_HANDLES.ROOT)).toBeVisible();

    await fillScormLessonFormFlow(page, {
      title: lessonTitle,
      packagePath: SCORM_TEST_DATA.files.singleScoPackage,
    });
    await expect(page.getByTestId(SCORM_LESSON_FORM_HANDLES.PACKAGE_SELECTED_FILE)).toBeVisible();
    await saveScormLessonFormFlow(page);

    const lessonId = await expect
      .poll(
        async () => {
          const updatedCourse = await courseFactory.getById(course.id);
          return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
            ?.id;
        },
        { timeout: 30_000 },
      )
      .not.toBeUndefined()
      .then(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]!.lessons!.find((lesson) => lesson.title === lessonTitle)!
          .id;
      });

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await expect(page.getByTestId(SCORM_LESSON_FORM_HANDLES.PACKAGE_READONLY)).toBeVisible();
    await expect(
      page.getByTestId(SCORM_LESSON_FORM_HANDLES.PACKAGE_INFO_TOOLTIP_TRIGGER),
    ).toBeVisible();

    await page.getByTestId(SCORM_LESSON_FORM_HANDLES.DELETE_BUTTON).click();
    await page.getByTestId(SCORM_LESSON_FORM_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.some((lesson) => lesson.id === lessonId);
      })
      .toBe(false);
  });
});
